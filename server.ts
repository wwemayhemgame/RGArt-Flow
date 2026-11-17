import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Nodemailer Transporter & Runtime SMTP Configuration
interface RuntimeSmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromName?: string;
  fromEmail?: string;
}

let runtimeSmtpConfig: RuntimeSmtpConfig | null = null;
let mailTransporter: nodemailer.Transporter | null = null;
let lastSmtpError: string | null = null;

function getEffectiveSmtpConfig(): RuntimeSmtpConfig | null {
  if (runtimeSmtpConfig && runtimeSmtpConfig.host && runtimeSmtpConfig.user && runtimeSmtpConfig.pass) {
    return runtimeSmtpConfig;
  }
  const rawUser = process.env.SMTP_USER?.trim() || '';
  const rawHost = process.env.SMTP_HOST?.trim() || (rawUser.endsWith('@zapak.com') || rawUser.endsWith('@reliancegames.com') ? 'reliancegames.icewarpcloud.in' : undefined);
  const rawPass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : (rawHost?.includes('icewarp') ? 465 : 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (rawHost && rawUser && rawPass) {
    return {
      host: rawHost,
      port,
      user: rawUser,
      pass: rawPass,
      secure,
      fromName: 'RG ArtFlow',
      fromEmail: rawUser
    };
  }
  return null;
}

function getMailTransporter(customConfig?: Partial<RuntimeSmtpConfig>): nodemailer.Transporter | null {
  const cfg = customConfig && customConfig.host && customConfig.user && customConfig.pass
    ? {
        host: customConfig.host,
        port: customConfig.port || (customConfig.host.includes('icewarp') ? 465 : 587),
        user: customConfig.user,
        pass: customConfig.pass.replace(/\s+/g, ''),
        secure: customConfig.secure ?? (customConfig.port === 465),
        fromName: customConfig.fromName || 'RG ArtFlow',
        fromEmail: customConfig.fromEmail || customConfig.user
      }
    : getEffectiveSmtpConfig();

  if (cfg) {
    try {
      mailTransporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: {
          rejectUnauthorized: false
        }
      });
      return mailTransporter;
    } catch (err: any) {
      lastSmtpError = err.message;
      console.error('[SMTP] Failed to initialize transporter:', err);
    }
  }
  return null;
}

// Lazy Google Gen AI Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Weekly Sprint Planner Endpoint (Monday - Friday Sprints)
app.post('/api/ai/sprint-planner', async (req, res) => {
  try {
    const { sprint, tasks, artists, excludedArtistIds } = req.body;

    if (!tasks || !Array.isArray(tasks) || !artists || !Array.isArray(artists)) {
      return res.status(400).json({ error: 'Tasks and artists arrays are required.' });
    }

    const excludedIds = Array.isArray(excludedArtistIds) ? excludedArtistIds : [];

    // Exclude Art Managers, Directors, Admins and Admin-Configured Excluded Users from AI auto-distribution
    const isManagementOrDirector = (a: any) => {
      const roleLower = (a.role || '').toLowerCase();
      return (
        a.isManagement === true ||
        a.userRole === 'ART_MANAGER' ||
        a.userRole === 'ART_DIRECTOR' ||
        a.userRole === 'ADMIN' ||
        roleLower.includes('manager') ||
        roleLower.includes('director') ||
        roleLower.includes('administrator') ||
        roleLower.includes('admin')
      );
    };

    const isExcluded = (a: any) => isManagementOrDirector(a) || excludedIds.includes(a.id);

    const eligibleArtists = artists.filter((a: any) => !isExcluded(a));
    const targetArtists = eligibleArtists;

    if (targetArtists.length === 0) {
      return res.json({
        recommendations: [],
        summary: 'No eligible production artists available for AI task distribution (all artists are excluded or management). Tasks left as Needs Assignment for manual allocation.',
        studioUtilizationPercent: 0
      });
    }

    const ai = getGeminiClient();

    // Prepare studio context for AI
    const sprintInfo = sprint || {
      name: 'Weekly Sprint (Mon-Fri)',
      startDate: 'Monday',
      endDate: 'Friday',
      workingDays: 5,
      capacityPerArtist: 40
    };

    if (ai) {
      const prompt = `You are the Lead Art Operations AI for a AAA Game Studio. 
Plan and distribute the unassigned backlog/sprint tasks across our production artists for a 1-WEEK SPRINT starting on MONDAY and ending on FRIDAY.
NOTE: Art Managers and Directors are EXCLUDED from auto-distribution and must never receive auto-assigned tasks.

SPRINT SPECIFICATIONS:
- Sprint: ${sprintInfo.name} (${sprintInfo.startDate} to ${sprintInfo.endDate})
- Duration: 5 working days (Monday to Friday)
- Standard Capacity: 40 hours per artist (reduced by meetings/allocation).

PRODUCTION ARTIST ROSTER (Available for assignment):
${JSON.stringify(
  targetArtists.map((a: any) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    specialization: a.specialization,
    weeklyCapacityHours: a.weeklyCapacity || 40,
    productionAllocation: a.productionAllocation || 85,
    effectiveCapacityHours: Math.round(((a.weeklyCapacity || 40) * (a.productionAllocation || 85)) / 100),
    currentCommittedHours: a.committedHours || 0,
    skills: a.skills?.map((s: any) => `${s.category}: ${s.rating}/5`).join(', ')
  })),
  null,
  2
)}

TASKS TO DISTRIBUTE:
${JSON.stringify(
  tasks.map((t: any) => ({
    id: t.id,
    title: t.title,
    taskType: t.taskType,
    priority: t.priority,
    originalEstimateHours: t.originalEstimate || 8,
    storyPoints: t.storyPoints || 3,
    currentArtistId: t.artistId || null
  })),
  null,
  2
)}

OBJECTIVE & RULES:
1. Automatically distribute each unassigned task to the single best-matched production artist based on their specialization and skill rating.
2. DO NOT assign any tasks to managers or directors.
3. Ensure no artist exceeds their weekly capacity (Monday to Friday, ~34-40 hours total). Balance workload evenly.
4. Prioritize 'Critical' and 'High' priority tasks first.
5. Output STRICT JSON format only:
{
  "recommendations": [
    {
      "taskId": "task-id",
      "recommendedArtistId": "artist-id",
      "recommendedArtistName": "Artist Name",
      "matchScore": 95,
      "matchReason": "Why this artist is the best fit (specialization, skill rating, and safe capacity headroom)",
      "estimatedHours": 8,
      "projectedArtistWorkloadPercent": 75
    }
  ],
  "summary": "Concise 2-sentence summary of sprint allocation health and workload distribution across production artists.",
  "studioUtilizationPercent": 68
}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call error, falling back to algorithmic planner:', geminiErr);
      }
    }

    // Algorithmic Fallback Distribution Engine
    // Computes optimal task allocation based on specialization, skill matrix, and remaining Mon-Fri capacity
    const artistLoads: Record<string, number> = {};
    targetArtists.forEach((a: any) => {
      artistLoads[a.id] = a.committedHours || 0;
    });

    const recommendations = tasks.map((task: any) => {
      const taskHours = task.originalEstimate || 8;

      // Score each artist
      const scoredArtists = targetArtists.map((a: any) => {
        let score = 50; // base score
        const specLower = (a.specialization || '').toLowerCase();
        const roleLower = (a.role || '').toLowerCase();
        const typeLower = (task.taskType || '').toLowerCase();

        if (roleLower.includes(typeLower) || specLower.includes(typeLower)) {
          score += 35;
        }

        // Check skill match
        const matchingSkill = a.skills?.find((s: any) =>
          typeLower.includes(s.category.toLowerCase()) || s.category.toLowerCase().includes(typeLower)
        );
        if (matchingSkill) {
          score += matchingSkill.rating * 5;
        }

        const effectiveCap = Math.round(((a.weeklyCapacity || 40) * (a.productionAllocation || 85)) / 100);
        const currentLoad = artistLoads[a.id] || 0;
        const projectedLoad = currentLoad + taskHours;
        const utilPercent = effectiveCap > 0 ? Math.round((projectedLoad / effectiveCap) * 100) : 100;

        // Penalize overcapacity
        if (utilPercent > 100) {
          score -= (utilPercent - 100) * 3;
        } else {
          score += (100 - utilPercent) * 0.2;
        }

        return {
          artist: a,
          score: Math.max(10, Math.min(99, Math.round(score))),
          utilPercent,
          effectiveCap
        };
      });

      scoredArtists.sort((a: any, b: any) => b.score - a.score);
      const best = scoredArtists[0];

      if (best) {
        artistLoads[best.artist.id] = (artistLoads[best.artist.id] || 0) + taskHours;
      }

      return {
        taskId: task.id,
        recommendedArtistId: best ? best.artist.id : targetArtists[0].id,
        recommendedArtistName: best ? best.artist.name : targetArtists[0].name,
        matchScore: best ? best.score : 80,
        matchReason: best
          ? `Specialized in ${best.artist.role} with ${best.artist.specialization}. Workload stays balanced at ${best.utilPercent}% of Monday-Friday capacity.`
          : 'Assigned based on available weekly capacity.',
        estimatedHours: taskHours,
        projectedArtistWorkloadPercent: best ? best.utilPercent : 75
      };
    });

    const totalCap = targetArtists.reduce(
      (acc: number, a: any) => acc + Math.round(((a.weeklyCapacity || 40) * (a.productionAllocation || 85)) / 100),
      0
    );
    const totalAssigned = Object.values(artistLoads).reduce((acc: number, val: number) => acc + val, 0);
    const studioUtil = totalCap > 0 ? Math.round((totalAssigned / totalCap) * 100) : 0;

    return res.json({
      recommendations,
      summary: `Auto-distributed ${tasks.length} tasks across ${targetArtists.length} production artists for 5-day Monday-Friday sprint (Art Managers/Directors excluded). Studio capacity is at ${studioUtil}%.`,
      studioUtilizationPercent: studioUtil
    });
  } catch (error: any) {
    console.error('Sprint planner error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Operations Copilot Chat API
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, studioStats } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ai = getGeminiClient();
    if (ai) {
      const prompt = `You are the Operations Copilot for a Game Art Studio managing weekly Monday-to-Friday sprints, 20 artists, task distributions, and work logs in days/hours/minutes.

STUDIO CONTEXT:
${JSON.stringify(studioStats || {}, null, 2)}

USER QUESTION:
${message}

Provide a concise, highly practical, and actionable answer (2-4 sentences max).`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt
        });

        if (response.text) {
          return res.json({ reply: response.text });
        }
      } catch (err) {
        console.warn('Gemini chat error, fallback to algorithmic response:', err);
      }
    }

    // Algorithmic chat response fallback
    const lower = message.toLowerCase();
    let reply = `Based on the 5-day weekly sprint (Monday to Friday, 40h standard artist capacity), our studio velocity and workload are optimal. You can use the AI Sprint Planner to auto-distribute unassigned tasks or review daily artist completion logs.`;

    if (lower.includes('sprint') || lower.includes('distribute') || lower.includes('weekly')) {
      reply = `Weekly sprints run Monday to Friday (40 hours capacity per artist). The AI Auto-Distributor matches tasks with each artist's skill matrix and balances workload under 85% capacity.`;
    } else if (lower.includes('capacity') || lower.includes('utilization') || lower.includes('overload')) {
      reply = `Studio capacity is monitored across 5 working days (Mon-Fri). Artists with >85% committed hours are flagged for load re-balancing to ensure zero delivery bottlenecks.`;
    } else if (lower.includes('time') || lower.includes('log') || lower.includes('daily')) {
      reply = `Artists can log work time flexibly in days (1d = 8h), hours (h), and minutes (m). Daily task reports show completed tasks and total time logged for each artist.`;
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Check SMTP Configuration Status & Run Live Handshake
app.get('/api/auth/smtp-status', async (req, res) => {
  const activeCfg = getEffectiveSmtpConfig();
  const isConfigured = !!activeCfg;
  const transporter = getMailTransporter();
  let verifyStatus = 'not_tested';
  let verifyError: string | null = null;

  if (transporter) {
    try {
      await transporter.verify();
      verifyStatus = 'verified_ready';
    } catch (vErr: any) {
      verifyStatus = 'verification_failed';
      verifyError = vErr.message;
    }
  }

  const displayUser = activeCfg?.user || process.env.SMTP_USER || '';
  const maskedUser = displayUser ? `${displayUser.substring(0, Math.min(3, displayUser.length))}***@${displayUser.split('@')[1] || ''}` : 'Not set';

  res.json({
    configured: isConfigured,
    smtpHost: activeCfg?.host ? `${activeCfg.host}:${activeCfg.port}` : (process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}` : 'Not configured'),
    smtpUser: maskedUser,
    activeUser: displayUser,
    hasPass: !!(activeCfg?.pass || process.env.SMTP_PASS),
    port: activeCfg?.port || 465,
    secure: activeCfg?.secure ?? true,
    verifyStatus,
    verifyError,
    adminEmail: process.env.ADMIN_EMAIL || 'ranjeet.patil@zapak.com',
    sender: activeCfg?.fromEmail ? `${activeCfg.fromName || 'RG ArtFlow'} <${activeCfg.fromEmail}>` : (process.env.SMTP_FROM || `RG ArtFlow <${process.env.SMTP_USER || 'ranjeet.patil@zapak.com'}>`)
  });
});

// Update & Save Active SMTP Configuration (In-Memory / Runtime)
app.post('/api/auth/save-smtp-config', async (req, res) => {
  try {
    const { host, port, user, pass, secure, fromName } = req.body;

    if (!host || !user || !pass) {
      return res.status(400).json({ error: 'host, user (email), and password are required to configure SMTP.' });
    }

    const cleanPass = pass.replace(/\s+/g, '');
    const cleanPort = port ? parseInt(String(port), 10) : (host.includes('icewarp') ? 465 : 587);
    const isSecure = secure !== undefined ? Boolean(secure) : (cleanPort === 465);

    const newConfig: RuntimeSmtpConfig = {
      host: host.trim(),
      port: cleanPort,
      user: user.trim(),
      pass: cleanPass,
      secure: isSecure,
      fromName: fromName?.trim() || 'RG ArtFlow',
      fromEmail: user.trim()
    };

    // Test connection with new config
    const testTransporter = getMailTransporter(newConfig);
    let verifyStatus = 'unknown';
    let verifyError: string | null = null;

    if (testTransporter) {
      try {
        await testTransporter.verify();
        verifyStatus = 'verified_ready';
        runtimeSmtpConfig = newConfig;
        mailTransporter = testTransporter;
        console.log(`[SMTP] Successfully configured and verified SMTP server: ${newConfig.host}:${newConfig.port} (${newConfig.user})`);
      } catch (verErr: any) {
        verifyStatus = 'verification_failed';
        verifyError = verErr.message;
        // Still save it so user can test or fix password
        runtimeSmtpConfig = newConfig;
        mailTransporter = testTransporter;
        console.warn(`[SMTP] Config saved but verification returned error: ${verErr.message}`);
      }
    }

    return res.json({
      success: true,
      verifyStatus,
      verifyError,
      activeConfig: {
        host: newConfig.host,
        port: newConfig.port,
        user: newConfig.user,
        secure: newConfig.secure,
        fromName: newConfig.fromName,
        fromEmail: newConfig.fromEmail
      }
    });
  } catch (err: any) {
    console.error('Save SMTP config error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save SMTP configuration.' });
  }
});

// Persistent Studio Users Directory (Resilient Store & Fallback for shared cloud quota limits)
const USERS_FILE_PATH = path.join(process.cwd(), 'data_studio_users.json');

const DEFAULT_SEED_ADMIN = {
  id: 'user-ranjeet',
  name: 'Ranjeet Patil',
  email: 'ranjeet.patil@zapak.com',
  officeId: 'OFF-1001',
  password: 'password123',
  role: 'ADMIN',
  artistId: 'artist-ranjeet',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  department: 'Studio Leadership',
  title: 'Studio Administrator & Head of Art',
  status: 'ACTIVE',
  approvedBy: 'SYSTEM',
  approvedByName: 'System Initializer',
  approvedAt: '2021-03-01T00:00:00Z',
  createdAt: '2021-03-01T00:00:00Z',
  verificationCode: '123456',
  isVerified: true,
  fieldPermissions: {
    canViewStoryPoints: true,
    canEditStoryPoints: true,
    canViewEstimates: true,
    canEditEstimates: true,
    canLogTime: true,
    canViewHourlyRates: true,
    canAssignArtists: true,
    canApproveRevisions: true,
    canManageSprints: true,
    canCreateProjects: true,
    canAccessAiPlanner: true,
    canViewReports: true
  }
};

let inMemoryUsers: any[] = [];

function loadStudioUsers(): any[] {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryUsers = parsed;
        return inMemoryUsers;
      }
    }
  } catch (err) {
    console.warn('[Users Store] Failed to read studio users file:', err);
  }
  if (inMemoryUsers.length === 0) {
    inMemoryUsers = [DEFAULT_SEED_ADMIN];
    saveStudioUsers(inMemoryUsers);
  }
  return inMemoryUsers;
}

function saveStudioUsers(users: any[]): void {
  inMemoryUsers = users;
  try {
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Users Store] Failed to persist studio users file:', err);
  }
}

// 1. Get all studio users
app.get('/api/studio/users', (req, res) => {
  const users = loadStudioUsers();
  res.json({ success: true, users });
});

// 2. Create or update a studio user
app.post('/api/studio/users', (req, res) => {
  try {
    const incomingUser = req.body;
    if (!incomingUser || (!incomingUser.id && !incomingUser.email)) {
      return res.status(400).json({ error: 'User id or email is required.' });
    }
    const users = loadStudioUsers();
    const cleanEmail = incomingUser.email?.trim().toLowerCase();
    const cleanOfficeId = incomingUser.officeId?.trim().toUpperCase();

    const idx = users.findIndex(
      (u: any) =>
        (incomingUser.id && u.id === incomingUser.id) ||
        (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
        (cleanOfficeId && u.officeId && u.officeId.toUpperCase() === cleanOfficeId)
    );

    if (idx >= 0) {
      users[idx] = { ...users[idx], ...incomingUser };
    } else {
      users.push(incomingUser);
    }
    saveStudioUsers(users);
    return res.json({ success: true, user: idx >= 0 ? users[idx] : incomingUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save user.' });
  }
});

// 3. Batch sync studio users
app.post('/api/studio/users/batch', (req, res) => {
  try {
    const incomingList = req.body?.users || [];
    if (!Array.isArray(incomingList)) {
      return res.status(400).json({ error: 'users must be an array.' });
    }
    const users = loadStudioUsers();
    for (const item of incomingList) {
      if (!item || (!item.id && !item.email)) continue;
      const cleanEmail = item.email?.trim().toLowerCase();
      const cleanOfficeId = item.officeId?.trim().toUpperCase();
      const idx = users.findIndex(
        (u: any) =>
          (item.id && u.id === item.id) ||
          (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
          (cleanOfficeId && u.officeId && u.officeId.toUpperCase() === cleanOfficeId)
      );
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...item };
      } else {
        users.push(item);
      }
    }
    saveStudioUsers(users);
    return res.json({ success: true, count: users.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Batch user sync failed.' });
  }
});

// 4. Delete user
app.delete('/api/studio/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const users = loadStudioUsers().filter((u: any) => u.id !== id);
    saveStudioUsers(users);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete user.' });
  }
});

// Test SMTP Connection and optionally send a test probe email
app.post('/api/auth/test-smtp-connection', async (req, res) => {
  try {
    const { host, port, user, pass, secure, testTargetEmail } = req.body;

    let targetConfig: RuntimeSmtpConfig | null = null;

    if (host && user && pass) {
      const cleanPort = port ? parseInt(String(port), 10) : (host.includes('icewarp') ? 465 : 587);
      targetConfig = {
        host: host.trim(),
        port: cleanPort,
        user: user.trim(),
        pass: pass.replace(/\s+/g, ''),
        secure: secure !== undefined ? Boolean(secure) : (cleanPort === 465),
        fromName: 'RG ArtFlow Test',
        fromEmail: user.trim()
      };
    } else {
      targetConfig = getEffectiveSmtpConfig();
    }

    if (!targetConfig) {
      return res.status(400).json({ error: 'No SMTP configuration provided or active.' });
    }

    const testTransporter = nodemailer.createTransport({
      host: targetConfig.host,
      port: targetConfig.port,
      secure: targetConfig.secure,
      auth: { user: targetConfig.user, pass: targetConfig.pass },
      tls: { rejectUnauthorized: false }
    });

    await testTransporter.verify();

    let emailSent = false;
    let messageId: string | undefined;

    if (testTargetEmail) {
      const info = await testTransporter.sendMail({
        from: `RG ArtFlow Studio Security <${targetConfig.user}>`,
        to: testTargetEmail,
        subject: `[RG ArtFlow Test] Mail Server Connected - ${new Date().toLocaleTimeString()}`,
        text: `Hello,\n\nThis is a confirmation test email from your RG ArtFlow Studio Operations platform.\n\nSender Server: ${targetConfig.host}:${targetConfig.port}\nSender Account: ${targetConfig.user}\nTimestamp: ${new Date().toISOString()}\n\nYour outbound email dispatch is operating properly!\n\nBest regards,\nRG ArtFlow Operations`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px;">
            <h2 style="color: #38bdf8; margin-top: 0;">RG ArtFlow &bull; Mail Dispatch Verified</h2>
            <p style="color: #cbd5e1; font-size: 14px;">Your custom SMTP server connection was successfully tested and verified.</p>
            <div style="background-color: #1e293b; border: 1px solid #334155; padding: 12px; border-radius: 8px; font-size: 13px; margin: 16px 0;">
              <div><strong>SMTP Host:</strong> ${targetConfig.host}:${targetConfig.port}</div>
              <div style="margin-top: 4px;"><strong>Sender Account:</strong> ${targetConfig.user}</div>
              <div style="margin-top: 4px;"><strong>Dispatched At:</strong> ${new Date().toLocaleString()}</div>
            </div>
            <p style="font-size: 12px; color: #94a3b8;">You will receive all password reset codes and team verification emails from this sender address.</p>
          </div>
        `
      });
      emailSent = true;
      messageId = info.messageId;
    }

    return res.json({
      success: true,
      verifyStatus: 'verified_ready',
      emailSent,
      messageId,
      host: targetConfig.host,
      port: targetConfig.port,
      user: targetConfig.user
    });
  } catch (err: any) {
    console.error('SMTP test error:', err);
    return res.status(400).json({
      success: false,
      verifyStatus: 'verification_failed',
      error: err.message || 'SMTP handshake failed.'
    });
  }
});

// Outbound Verification Email Dispatch API
app.post('/api/auth/send-verification-email', async (req, res) => {
  try {
    const { toEmail, toName, verificationCode, officeId } = req.body;

    if (!toEmail || !verificationCode) {
      return res.status(400).json({ error: 'toEmail and verificationCode are required.' });
    }

    const activeCfg = getEffectiveSmtpConfig();
    const adminEmail = process.env.ADMIN_EMAIL || activeCfg?.fromEmail || 'ranjeet.patil@zapak.com';
    const sender = activeCfg?.fromEmail 
      ? `${activeCfg.fromName || 'RG ArtFlow'} <${activeCfg.fromEmail}>` 
      : (process.env.SMTP_FROM || `RG ArtFlow <${process.env.SMTP_USER || 'ranjeet.patil@zapak.com'}>`);
    const recipientName = toName || 'Team Member';
    const assignedOfficeId = officeId || 'OFF-PENDING';

    const subject = `[Security Code: ${verificationCode}] Studio Access Verification - RG ArtFlow`;
    const textBody = `Hello ${recipientName},

Your 6-digit email verification code for RG ArtFlow Studio Access is:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION CODE: ${verificationCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Office ID: ${assignedOfficeId}
Sender: RG ArtFlow Administrator (${adminEmail})

Enter this code on the verification screen to confirm your identity. Once confirmed, your request will be forwarded to Studio Operations for final role assignment and dashboard access.

If you did not request this, please ignore this email.

Best regards,
RG ArtFlow Studio Operations
Email: ${adminEmail}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 700; }
    .content { padding: 30px 24px; line-height: 1.6; color: #e2e8f0; }
    .code-box { background: #0f172a; border: 2px dashed #3b82f6; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }
    .code-number { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #60a5fa; font-family: monospace; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .meta-table td { padding: 8px 12px; border-bottom: 1px solid #334155; }
    .meta-label { color: #94a3b8; font-weight: 600; width: 35%; }
    .meta-value { color: #f8fafc; font-weight: 500; }
    .footer { background-color: #0f172a; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RG ArtFlow — Studio Verification</h1>
      <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 13px;">Game Art Operations Platform</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 13px; color: #cbd5e1;">You requested access to the RG ArtFlow studio production platform. Please use the 6-digit verification code below to verify your work email address:</p>
      
      <div class="code-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px;">Your 6-Digit Verification Code</div>
        <div class="code-number">${verificationCode}</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Work Email</td>
          <td class="meta-value">${toEmail}</td>
        </tr>
        <tr>
          <td class="meta-label">Assigned Office ID</td>
          <td class="meta-value"><code>${assignedOfficeId}</code></td>
        </tr>
        <tr>
          <td class="meta-label">Sent By</td>
          <td class="meta-value">${adminEmail}</td>
        </tr>
        <tr>
          <td class="meta-label">Next Step</td>
          <td class="meta-value">Pending Administrator Approval</td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #94a3b8;">Once you submit this verification code, your request will be directly sent to Studio Administrator for review.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">RG ArtFlow Operations &bull; Zapak / Reliance Games</p>
      <p style="margin: 4px 0 0 0;">Administrator contact: <a href="mailto:${adminEmail}" style="color: #60a5fa; text-decoration: none;">${adminEmail}</a></p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getMailTransporter();
    let dispatchStatus = 'queued_in_firestore';
    let messageId: string | undefined;

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: sender,
          to: toEmail,
          subject,
          text: textBody,
          html: htmlBody
        });
        dispatchStatus = 'sent_via_smtp';
        messageId = info.messageId;
        console.log(`[SMTP] Verification email sent to ${toEmail} (ID: ${info.messageId})`);
      } catch (smtpErr: any) {
        console.warn(`[SMTP] Direct delivery failed, falling back to Firestore mail queue:`, smtpErr.message);
        dispatchStatus = 'smtp_failed_queued_in_firestore';
      }
    } else {
      console.log(`[MAIL] No SMTP server configured. Dispatched via Firestore / trigger mail from ${adminEmail} to ${toEmail}`);
    }

    return res.json({
      success: true,
      status: dispatchStatus,
      messageId,
      sender: adminEmail,
      recipient: toEmail,
      subject
    });
  } catch (err: any) {
    console.error('Send verification email error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process email dispatch.' });
  }
});

// Outbound Password Reset Email Dispatch API
app.post('/api/auth/send-reset-email', async (req, res) => {
  try {
    const { toEmail, toName, resetCode, officeId } = req.body;

    if (!toEmail || !resetCode) {
      return res.status(400).json({ error: 'toEmail and resetCode are required.' });
    }

    const activeCfg = getEffectiveSmtpConfig();
    const adminEmail = process.env.ADMIN_EMAIL || activeCfg?.fromEmail || 'ranjeet.patil@zapak.com';
    const sender = activeCfg?.fromEmail 
      ? `${activeCfg.fromName || 'RG ArtFlow'} <${activeCfg.fromEmail}>` 
      : (process.env.SMTP_FROM || `RG ArtFlow <${process.env.SMTP_USER || 'ranjeet.patil@zapak.com'}>`);
    const recipientName = toName || 'Team Member';
    const assignedOfficeId = officeId || 'OFF-REGISTERED';

    const subject = `[Security Code: ${resetCode}] Password Reset Request - RG ArtFlow`;
    const textBody = `Hello ${recipientName},

A password reset was requested for your RG ArtFlow account (${toEmail}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSWORD RESET CODE: ${resetCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: ${toEmail}
Office ID: ${assignedOfficeId}
Expires in: 30 minutes

Please enter this 6-digit code on the Password Reset screen and choose your new password.

If you did not request this password reset, please contact Studio Support immediately.

Best regards,
RG ArtFlow Operations & Studio Security`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 700; }
    .content { padding: 30px 24px; line-height: 1.6; color: #e2e8f0; }
    .code-box { background: #0f172a; border: 2px dashed #8b5cf6; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0; }
    .code-number { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #a78bfa; font-family: monospace; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .meta-table td { padding: 8px 12px; border-bottom: 1px solid #334155; }
    .meta-label { color: #94a3b8; font-weight: 600; width: 35%; }
    .meta-value { color: #f8fafc; font-weight: 500; }
    .footer { background-color: #0f172a; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RG ArtFlow — Password Recovery</h1>
      <p style="margin: 4px 0 0 0; color: #ddd6fe; font-size: 13px;">Studio Account Security</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 13px; color: #cbd5e1;">A password reset request was initiated for your studio account (${toEmail}). Please use the 6-digit recovery code below to set your new password:</p>
      
      <div class="code-box">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px;">Your 6-Digit Password Reset Code</div>
        <div class="code-number">${resetCode}</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="meta-label">Recipient Email</td>
          <td class="meta-value"><strong>${toEmail}</strong></td>
        </tr>
        <tr>
          <td class="meta-label">Office ID</td>
          <td class="meta-value"><code>${assignedOfficeId}</code></td>
        </tr>
        <tr>
          <td class="meta-label">Valid Duration</td>
          <td class="meta-value">30 Minutes</td>
        </tr>
      </table>

      <p style="font-size: 12px; color: #94a3b8;">If you did not request this password reset, please ignore this message.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">RG ArtFlow Operations &bull; Studio Security</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getMailTransporter();
    let dispatchStatus = 'queued_in_firestore';
    let messageId: string | undefined;

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: sender,
          to: toEmail,
          subject,
          text: textBody,
          html: htmlBody
        });
        dispatchStatus = 'sent_via_smtp';
        messageId = info.messageId;
        console.log(`[SMTP] Password reset email sent to ${toEmail} (ID: ${info.messageId})`);
      } catch (smtpErr: any) {
        console.warn(`[SMTP] Direct reset delivery failed, falling back to Firestore queue:`, smtpErr.message);
        dispatchStatus = 'smtp_failed_queued_in_firestore';
      }
    }

    return res.json({
      success: true,
      status: dispatchStatus,
      messageId,
      sender: adminEmail,
      recipient: toEmail,
      subject
    });
  } catch (err: any) {
    console.error('Send reset email error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process reset email dispatch.' });
  }
});

// Outbound Task Activity Notification Dispatch API
app.post('/api/mail/send-task-activity-email', async (req, res) => {
  try {
    const {
      toEmail,
      toName,
      actorName,
      activityType,
      taskId,
      taskTitle,
      projectName,
      details,
      priority,
      dueDate,
      status
    } = req.body;

    if (!toEmail || !taskId || !taskTitle) {
      return res.status(400).json({ error: 'toEmail, taskId, and taskTitle are required.' });
    }

    const activeCfg = getEffectiveSmtpConfig();
    const adminEmail = process.env.ADMIN_EMAIL || activeCfg?.fromEmail || 'ranjeet.patil@zapak.com';
    const sender = activeCfg?.fromEmail 
      ? `${activeCfg.fromName || 'RG ArtFlow'} <${activeCfg.fromEmail}>` 
      : (process.env.SMTP_FROM || `RG ArtFlow <${process.env.SMTP_USER || 'ranjeet.patil@zapak.com'}>`);
    const recipient = toName || 'Team Member';
    const actor = actorName || 'RG ArtFlow System';
    const project = projectName || 'Studio Project';

    let subjectPrefix = 'Task Update';
    let badgeColor = '#2563eb';
    let actionHeader = 'Task Activity Update';

    switch (activityType) {
      case 'ASSIGNED':
        subjectPrefix = '🎨 New Task Assigned';
        badgeColor = '#7c3aed';
        actionHeader = 'You Have Been Assigned a New Task';
        break;
      case 'STATUS_CHANGED':
        subjectPrefix = `⚡ Status: ${status || 'Updated'}`;
        badgeColor = '#0284c7';
        actionHeader = `Task Status Changed to ${status || 'In Progress'}`;
        break;
      case 'DELIVERED':
        subjectPrefix = '🎉 Art Delivered & Completed';
        badgeColor = '#059669';
        actionHeader = 'Asset Delivered & Ready for Pickup';
        break;
      case 'REVISION_REQUESTED':
        subjectPrefix = '✏️ Revision Requested';
        badgeColor = '#d97706';
        actionHeader = 'New Revision Feedback Submitted';
        break;
      case 'COMMENT_ADDED':
        subjectPrefix = '💬 New Comment';
        badgeColor = '#4f46e5';
        actionHeader = 'New Feedback & Discussion on Task';
        break;
      case 'BLOCKED_ALERT':
        subjectPrefix = '🚨 Task Blocked Alert';
        badgeColor = '#dc2626';
        actionHeader = 'Production Blocker Reported';
        break;
      case 'REQUEST_CREATED':
        subjectPrefix = '📋 New Company Request';
        badgeColor = '#0891b2';
        actionHeader = 'New Asset Request Submitted';
        break;
      default:
        subjectPrefix = '📌 Task Notification';
    }

    const subject = `[${taskId}] ${subjectPrefix} — ${taskTitle}`;
    const textBody = `Hello ${recipient},

${actionHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task: [${taskId}] ${taskTitle}
Project: ${project}
Action by: ${actor}
${status ? `Current Status: ${status}\n` : ''}${priority ? `Priority: ${priority}\n` : ''}${dueDate ? `Due / Delivery: ${dueDate}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Details / Comments:
${details || 'No additional notes provided.'}

To review or take action on this task, please log into RG ArtFlow Studio.

Best regards,
RG ArtFlow Operations & Studio Management
Zapak / Reliance Games`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: ${badgeColor}; padding: 22px 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; }
    .content { padding: 24px; color: #e2e8f0; font-size: 13px; line-height: 1.6; }
    .task-card { background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin: 18px 0; }
    .task-id { font-family: monospace; font-weight: 700; color: #38bdf8; font-size: 14px; }
    .task-title { font-size: 15px; font-weight: 700; color: #ffffff; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; font-size: 12px; }
    .meta-item { background: #1e293b; padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; }
    .meta-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-val { color: #f8fafc; font-weight: 600; margin-top: 2px; }
    .detail-box { background: #1e293b; border-left: 3px solid ${badgeColor}; padding: 12px 14px; border-radius: 4px; margin-top: 14px; font-size: 13px; color: #cbd5e1; white-space: pre-wrap; }
    .footer { background-color: #0f172a; padding: 16px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${actionHeader}</h1>
      <p>RG ArtFlow Studio Activity Notification &bull; ${project}</p>
    </div>
    <div class="content">
      <p style="margin-top: 0;">Hello <strong>${recipient}</strong>,</p>
      <p>An update has occurred on a task you are associated with, initiated by <strong>${actor}</strong>:</p>

      <div class="task-card">
        <div class="task-id">${taskId}</div>
        <div class="task-title">${taskTitle}</div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px;">
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; width: 35%;">Project:</td>
            <td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${project}</td>
          </tr>
          ${status ? `<tr><td style="padding: 6px 0; color: #94a3b8;">Status:</td><td style="padding: 6px 0; color: #38bdf8; font-weight: 600;">${status}</td></tr>` : ''}
          ${priority ? `<tr><td style="padding: 6px 0; color: #94a3b8;">Priority:</td><td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${priority}</td></tr>` : ''}
          ${dueDate ? `<tr><td style="padding: 6px 0; color: #94a3b8;">Due / Delivery:</td><td style="padding: 6px 0; color: #f8fafc; font-weight: 600;">${dueDate}</td></tr>` : ''}
        </table>

        ${details ? `<div class="detail-box"><strong>Activity Details:</strong><br>${details}</div>` : ''}
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">Log in to the RG ArtFlow dashboard to view full assets, comments, and task timeline.</p>
    </div>
    <div class="footer">
      <p style="margin: 0;">RG ArtFlow Studio Operations &bull; Zapak / Reliance Games</p>
      <p style="margin: 4px 0 0 0;">Studio Lead: ${adminEmail}</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getMailTransporter();
    let dispatchStatus = 'queued_in_firestore';
    let messageId: string | undefined;

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: sender,
          to: toEmail,
          subject,
          text: textBody,
          html: htmlBody
        });
        dispatchStatus = 'sent_via_smtp';
        messageId = info.messageId;
        console.log(`[SMTP] Task activity email sent to ${toEmail} for ${taskId} (ID: ${info.messageId})`);
      } catch (smtpErr: any) {
        console.warn(`[SMTP] Direct task notification delivery failed, fallback queued:`, smtpErr.message);
        dispatchStatus = 'smtp_failed_queued_in_firestore';
      }
    }

    return res.json({
      success: true,
      status: dispatchStatus,
      messageId,
      recipient: toEmail,
      taskId,
      subject
    });
  } catch (err: any) {
    console.error('Send task activity email error:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch task activity email.' });
  }
});

// Test Email Dispatch Diagnostic API
app.post('/api/auth/send-test-email', async (req, res) => {
  try {
    const { targetEmail } = req.body;
    const adminEmail = process.env.ADMIN_EMAIL || 'ranjeet.patil@zapak.com';
    const toEmail = targetEmail || adminEmail;
    const sender = process.env.SMTP_FROM || `RG ArtFlow <${process.env.SMTP_USER || 'wwemayhemgame@gmail.com'}>`;
    const transporter = getMailTransporter();

    const testSubject = `[RG ArtFlow Test] Outbound Verification Delivery Test`;
    const testBody = `This is a test verification email from RG ArtFlow Studio.\nSent by RG ArtFlow (${adminEmail}) to confirm outbound email delivery to ${toEmail}.`;

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: sender,
          to: toEmail,
          subject: testSubject,
          text: testBody,
          html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>RG ArtFlow — Email Delivery Test</h2>
            <p>This confirms that your SMTP mail server is successfully configured to send verification codes to <strong>${toEmail}</strong>.</p>
            <p style="color: #64748b; font-size: 12px;">Sent from: ${sender}</p>
          </div>`
        });
        return res.json({
          success: true,
          mode: 'smtp',
          messageId: info.messageId,
          message: `Test email successfully delivered to ${toEmail} via SMTP.`
        });
      } catch (smtpErr: any) {
        return res.status(500).json({
          success: false,
          mode: 'smtp_error',
          error: smtpErr.message || 'SMTP delivery failed. Check your credentials in settings.'
        });
      }
    } else {
      return res.json({
        success: true,
        mode: 'firebase_queue',
        message: `Email queued in Firebase /mail collection for ${toEmail}. To send via live SMTP, configure SMTP_HOST/USER/PASS in Settings or install the Firebase Trigger Email Extension.`
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// JIRA REST API PROXY & TWO-WAY SYNC ENGINE (STUDIO-WIDE APP GATEWAY)
// ==========================================

interface ServerJiraConfig {
  hostUrl: string;
  email: string;
  apiToken: string;
  defaultProjectKeys: string;
  autoSyncOnStatusChange: boolean;
  autoSyncWorklogs: boolean;
  autoPostImagesToJira?: boolean;
  projectMappings?: Array<{ jiraProjectKey: string; studioProjectId: string; jiraProjectName?: string }>;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastConnectedAt?: string;
  lastConnectionError?: string;
}

const DEFAULT_JIRA_MIGRATION_PROJECTS = [
  'CRXG', 'CH', 'AS', 'CRICK83', 'AMTT', 'AMDI', 'APT', 'AQS', 'AT', 'B10HTML',
  'BSR', 'BAR', 'BWHTML', 'CNL', 'CG', 'CGQS', 'CIDR', 'CT', 'CTP', 'CCL',
  'CB', 'DQS', 'DT', 'SS2GA', 'D2QN', 'DRON', 'D4', 'D4QB', 'DRN5', 'DSS',
  'DRNU', 'DYS', 'EI', 'EMO', 'EXD', 'FS', 'GI', 'GPK', 'GPKQ', 'GJ',
  'GP', 'HBKJ', 'ITBL', 'ITB', 'ITBC', 'IQ', 'KAN', 'KD', 'KBPM', 'KSS',
  'LOB', 'LKV2', 'LKJR', 'RADHA', 'RAM', 'LS', 'NLS2', 'LIT', 'LSC', 'LS2',
  'LSHTML', 'LSL', 'LSS', 'LST', 'LKDHHTML', 'LT', 'LUDO', 'MLW', 'MC', 'ARTMKT',
  'MTG', 'MTQ', 'MT', 'MM', 'NLO', 'NTK', 'NSHTML5', 'PR2', 'PIB', 'SDKS',
  'SDKTS', 'PQ', 'PL', 'PLQ', 'PB', 'PUSS', 'QTD', 'QT', 'RD', 'RWAR',
  'RP', 'RS', 'WB', 'WRB', 'RCMC', 'RN21', 'RUNKRIS', 'RQS', 'RH', 'SSP',
  'SDKTAS', 'SERVER', 'SIMB', 'RTRO', 'T20NEW', 'TCRIC', 'CS2D', 'TTT', 'UAC', 'UFZ',
  'URF', 'UZFQA', 'WCPL', 'WCCF', 'CUP16', 'WRB2', 'RSWRB', 'WQN', 'QA', 'RSWRB2',
  'WWE', 'WWEN', 'WQS', 'WQT', 'WQ'
];

const DEFAULT_JIRA_PROJECTS_STRING = DEFAULT_JIRA_MIGRATION_PROJECTS.join(', ');
const JIRA_CONFIG_FILE_PATH = path.join(process.cwd(), 'data_jira_config.json');

function loadAppJiraConfig(): ServerJiraConfig {
  let cfg: ServerJiraConfig = {
    hostUrl: (process.env.JIRA_HOST_URL || 'https://reliancegames.atlassian.net').trim(),
    email: (process.env.JIRA_EMAIL || 'ranjeet.patil@zapak.com').trim(),
    apiToken: (process.env.JIRA_API_TOKEN || '').trim(),
    defaultProjectKeys: (process.env.JIRA_PROJECT_KEYS || DEFAULT_JIRA_PROJECTS_STRING).trim(),
    autoSyncOnStatusChange: true,
    autoSyncWorklogs: true,
    autoPostImagesToJira: true,
    projectMappings: [
      { jiraProjectKey: 'WWE', studioProjectId: 'proj-wwe', jiraProjectName: 'WWE Mayhem' },
      { jiraProjectKey: 'ARTMKT', studioProjectId: 'proj-art', jiraProjectName: 'Marketing & Live Operations Art' },
      { jiraProjectKey: 'ART', studioProjectId: 'proj-art', jiraProjectName: 'Marketing & Live Operations Art' }
    ],
    connectionStatus: (process.env.JIRA_HOST_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) ? 'connected' : 'disconnected'
  };

  try {
    if (fs.existsSync(JIRA_CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(JIRA_CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        cfg = {
          ...cfg,
          ...parsed,
          defaultProjectKeys: parsed.defaultProjectKeys || cfg.defaultProjectKeys || DEFAULT_JIRA_PROJECTS_STRING
        };
      }
    }
  } catch (err) {
    console.warn('[Jira Store] Failed to read jira config file:', err);
  }

  // Ensure defaultProjectKeys contains the full 125 migration projects if it was using the old 3-project default
  if (!cfg.defaultProjectKeys || cfg.defaultProjectKeys === 'WWE, ART, MAYHEM' || cfg.defaultProjectKeys.trim().length === 0) {
    cfg.defaultProjectKeys = DEFAULT_JIRA_PROJECTS_STRING;
  }

  // Ensure file is initialized on disk if it didn't exist
  try {
    if (!fs.existsSync(JIRA_CONFIG_FILE_PATH)) {
      fs.writeFileSync(JIRA_CONFIG_FILE_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[Jira Store] Failed to initialize default jira config on disk:', err);
  }

  return cfg;
}

function saveAppJiraConfig(config: ServerJiraConfig): void {
  appJiraConfig = config;
  try {
    fs.writeFileSync(JIRA_CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Jira Store] Failed to persist jira config file:', err);
  }
}

// Studio-wide app integration configuration in server memory & disk
let appJiraConfig: ServerJiraConfig = loadAppJiraConfig();

function normalizeJiraUrl(url: string): string {
  let clean = (url || '').trim().replace(/['"]/g, '');
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  clean = clean.replace(/\/+$/, '');
  
  // If user included /jira, /browse, /jira/..., /secure etc., strip it back to the base domain
  try {
    const parsed = new URL(clean);
    // If it is an atlassian.net cloud domain or standard host with /jira path
    if (parsed.pathname === '/jira' || parsed.pathname.startsWith('/jira/')) {
      clean = `${parsed.protocol}//${parsed.host}`;
    } else if (parsed.pathname.startsWith('/browse') || parsed.pathname.startsWith('/secure')) {
      clean = `${parsed.protocol}//${parsed.host}`;
    }
  } catch (e) {}

  return clean.replace(/\/+$/, '');
}

function cleanJiraCredentials(email: string | any, token: string | any) {
  const cleanEmail = String(email || '').trim().replace(/['"]/g, '');
  const cleanToken = String(token || '').trim().replace(/['"]/g, '');
  return { cleanEmail, cleanToken };
}

function formatProjectKeysString(val: any): string {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(k => String(k || '').trim()).filter(Boolean).join(',');
  }
  return String(val).trim();
}

function resolveJiraCredentials(body: any = {}) {
  const rawHost = body.hostUrl || appJiraConfig.hostUrl || '';
  const hostUrl = normalizeJiraUrl(String(rawHost || '').trim());
  const email = String(body.email || appJiraConfig.email || '').trim();
  const apiToken = String(body.apiToken || appJiraConfig.apiToken || '').trim();
  const projectKeys = formatProjectKeysString(body.projectKeys ?? body.defaultProjectKeys ?? appJiraConfig.defaultProjectKeys);
  return { hostUrl, email, apiToken, projectKeys };
}

function createJiraAuthHeader(email: string, token: string): string {
  const { cleanEmail, cleanToken } = cleanJiraCredentials(email, token);
  const buff = Buffer.from(`${cleanEmail}:${cleanToken}`).toString('base64');
  return `Basic ${buff}`;
}

// 0. Get & Update App-Wide Jira Integration Config
app.get('/api/jira/config', (req, res) => {
  return res.json({
    success: true,
    config: {
      hostUrl: appJiraConfig.hostUrl,
      email: appJiraConfig.email,
      defaultProjectKeys: appJiraConfig.defaultProjectKeys,
      autoSyncOnStatusChange: appJiraConfig.autoSyncOnStatusChange,
      autoSyncWorklogs: appJiraConfig.autoSyncWorklogs,
      autoPostImagesToJira: appJiraConfig.autoPostImagesToJira,
      projectMappings: appJiraConfig.projectMappings,
      connectionStatus: appJiraConfig.connectionStatus,
      lastConnectedAt: appJiraConfig.lastConnectedAt,
      lastConnectionError: appJiraConfig.lastConnectionError,
      hasToken: Boolean(appJiraConfig.apiToken && appJiraConfig.apiToken.length > 0)
    }
  });
});

app.post('/api/jira/config', (req, res) => {
  const { hostUrl, email, apiToken, defaultProjectKeys, autoSyncOnStatusChange, autoSyncWorklogs, autoPostImagesToJira, projectMappings } = req.body || {};
  if (hostUrl) appJiraConfig.hostUrl = normalizeJiraUrl(hostUrl);
  if (email) appJiraConfig.email = email.trim();
  if (apiToken !== undefined && apiToken.trim().length > 0) appJiraConfig.apiToken = apiToken.trim();
  if (defaultProjectKeys !== undefined) {
    const trimmedKeys = defaultProjectKeys.trim();
    appJiraConfig.defaultProjectKeys = trimmedKeys.length > 0 ? trimmedKeys : DEFAULT_JIRA_PROJECTS_STRING;
  }
  if (autoSyncOnStatusChange !== undefined) appJiraConfig.autoSyncOnStatusChange = Boolean(autoSyncOnStatusChange);
  if (autoSyncWorklogs !== undefined) appJiraConfig.autoSyncWorklogs = Boolean(autoSyncWorklogs);
  if (autoPostImagesToJira !== undefined) appJiraConfig.autoPostImagesToJira = Boolean(autoPostImagesToJira);
  if (Array.isArray(projectMappings)) appJiraConfig.projectMappings = projectMappings;

  saveAppJiraConfig(appJiraConfig);

  return res.json({
    success: true,
    message: 'App-level Jira configuration saved successfully on studio server and persisted to disk.',
    config: {
      hostUrl: appJiraConfig.hostUrl,
      email: appJiraConfig.email,
      defaultProjectKeys: appJiraConfig.defaultProjectKeys,
      autoSyncOnStatusChange: appJiraConfig.autoSyncOnStatusChange,
      autoSyncWorklogs: appJiraConfig.autoSyncWorklogs,
      autoPostImagesToJira: appJiraConfig.autoPostImagesToJira,
      projectMappings: appJiraConfig.projectMappings,
      connectionStatus: appJiraConfig.connectionStatus,
      lastConnectedAt: appJiraConfig.lastConnectedAt,
      hasToken: Boolean(appJiraConfig.apiToken)
    }
  });
});

// 1. Test Jira Connection & Verify Lead Credentials
app.post('/api/jira/test-connection', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira hostUrl, email, and apiToken are required. Please configure credentials in Settings.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const basicAuth = createJiraAuthHeader(cleanEmail, cleanToken);

    // Try API v3 first, then fallback to API v2 if v3 is not supported
    const endpointsToTry = [
      { url: `${base}/rest/api/3/myself`, auth: basicAuth, isV3: true },
      { url: `${base}/rest/api/2/myself`, auth: basicAuth, isV3: false },
      // Also try Bearer token in case it is a Personal Access Token (PAT)
      { url: `${base}/rest/api/2/myself`, auth: `Bearer ${cleanToken}`, isV3: false }
    ];

    let successResponse: any = null;
    let lastErrorStatus = 401;
    let lastErrorText = '';
    let chosenAuth = basicAuth;
    let chosenApiVersion = 3;

    for (const attempt of endpointsToTry) {
      try {
        const testRes = await fetch(attempt.url, {
          method: 'GET',
          headers: {
            'Authorization': attempt.auth,
            'Accept': 'application/json'
          }
        });

        if (testRes.ok) {
          const userJson = await testRes.json();
          successResponse = userJson;
          chosenAuth = attempt.auth;
          chosenApiVersion = attempt.isV3 ? 3 : 2;
          break;
        } else {
          lastErrorStatus = testRes.status;
          lastErrorText = await testRes.text();
        }
      } catch (err: any) {
        lastErrorText = err.message || 'Connection error';
      }
    }

    if (!successResponse) {
      let parsedErr = lastErrorText;
      try {
        const j = JSON.parse(lastErrorText);
        parsedErr = j.errorMessages?.join(', ') || j.message || lastErrorText;
      } catch (e) {}

      let diagnosticHelp = '';
      if (lastErrorStatus === 401) {
        diagnosticHelp = `Atlassian 401 Unauthorized occurs when:
1. The Email "${cleanEmail}" does not exactly match the Atlassian account that generated the token.
2. An account password was entered instead of an API Token generated at https://id.atlassian.com/manage-profile/security/api-tokens
3. The API token was revoked or expired.`;
      }

      appJiraConfig.connectionStatus = 'error';
      appJiraConfig.lastConnectionError = parsedErr;

      return res.status(lastErrorStatus).json({
        success: false,
        error: `Jira authentication failed (${lastErrorStatus}): ${parsedErr}`,
        diagnosticHelp
      });
    }

    // Persist verified config at app-level
    appJiraConfig.hostUrl = base;
    appJiraConfig.email = cleanEmail;
    appJiraConfig.apiToken = cleanToken;
    appJiraConfig.connectionStatus = 'connected';
    appJiraConfig.lastConnectedAt = new Date().toISOString();
    appJiraConfig.lastConnectionError = undefined;
    saveAppJiraConfig(appJiraConfig);

    const myself = successResponse;

    // Fetch accessible projects
    let projects: any[] = [];
    try {
      const projUrl = `${base}/rest/api/${chosenApiVersion}/project`;
      const projRes = await fetch(projUrl, {
        method: 'GET',
        headers: { 'Authorization': chosenAuth, 'Accept': 'application/json' }
      });
      if (projRes.ok) {
        projects = await projRes.json();
      }
    } catch (pErr) {
      console.warn('Could not fetch Jira projects list:', pErr);
    }

    return res.json({
      success: true,
      user: {
        accountId: myself.accountId || myself.key || myself.name,
        displayName: myself.displayName || myself.name,
        emailAddress: myself.emailAddress || cleanEmail,
        active: myself.active !== false,
        timeZone: myself.timeZone || 'UTC',
        avatarUrl: myself.avatarUrls?.['48x48'] || myself.avatarUrls?.['32x32']
      },
      projects: projects.map((p: any) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey
      }))
    });
  } catch (err: any) {
    console.error('Jira test connection error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Connection error connecting to Jira.' });
  }
});

// Fallback Jira Project Metadata Registry for Known Projects
const DEFAULT_JIRA_PROJECT_METADATA: Record<string, any> = {
  WWE: {
    projectId: '10000',
    projectKey: 'WWE',
    projectName: 'WWE Mayhem',
    issueTypes: [
      { id: '10001', name: 'Story', description: 'User story / feature ticket', subtask: false },
      { id: '10002', name: 'Task', description: 'General production task', subtask: false },
      { id: '10004', name: 'Bug', description: 'Defect or visual issue', subtask: false },
      { id: '10000', name: 'Epic', description: 'High-level epic initiative', subtask: false }
    ],
    fixVersions: [
      { id: '10201', name: 'Update 98', released: false, archived: false },
      { id: '10202', name: 'Update 99', released: false, archived: false },
      { id: '10203', name: 'Update 100', released: false, archived: false },
      { id: '10204', name: 'Season 12', released: false, archived: false },
      { id: '10205', name: 'LiveOps 2026', released: false, archived: false }
    ],
    components: [
      { id: '10101', name: '2D Art', description: '2D Art assets, illustrations, sprites' },
      { id: '10102', name: '2D Animation', description: '2D Spine & UI Animations' },
      { id: '10103', name: '3D', description: '3D Character & Environment assets' },
      { id: '10104', name: 'Audio', description: 'Music, Sound effects, Voice-overs' },
      { id: '10105', name: 'Game Design', description: 'Game balance, mechanics, level design' },
      { id: '10106', name: 'Production', description: 'Project management & planning' },
      { id: '10107', name: 'Marketing', description: 'App Store, promotional banners & social assets' },
      { id: '10108', name: 'UI', description: 'User Interface layouts & icon sheets' },
      { id: '10109', name: 'VFX', description: 'Visual effects & particles' }
    ],
    priorities: [
      { id: '1', name: 'Highest' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' },
      { id: '4', name: 'Low' },
      { id: '5', name: 'Lowest' }
    ],
    defaultIssueTypeId: '10001',
    defaultIssueTypeName: 'Story',
    requiredFields: {
      '10001': ['summary', 'issuetype', 'project', 'components', 'fixVersions'],
      '10002': ['summary', 'issuetype', 'project', 'components', 'fixVersions'],
      '10004': ['summary', 'issuetype', 'project', 'components', 'fixVersions']
    },
    lastRefreshedAt: new Date().toISOString()
  },
  ART: {
    projectId: '10001',
    projectKey: 'ART',
    projectName: 'Art Studio Operations',
    issueTypes: [
      { id: '10011', name: 'Story', description: 'Art Request / Delivery', subtask: false },
      { id: '10012', name: 'Task', description: 'Art Asset Creation', subtask: false },
      { id: '10013', name: 'Revision', description: 'Iteration / Polish pass', subtask: false },
      { id: '10014', name: 'Bug', description: 'Visual defect or broken texture', subtask: false }
    ],
    fixVersions: [
      { id: '10211', name: 'Sprint 2026.1', released: false, archived: false },
      { id: '10212', name: 'Sprint 2026.2', released: false, archived: false },
      { id: '10213', name: 'Q3 Deliverables', released: false, archived: false }
    ],
    components: [
      { id: '10111', name: 'Concept Art', description: 'Visual development & mood boards' },
      { id: '10112', name: 'Character Art', description: '3D Characters & High-poly sculpts' },
      { id: '10113', name: 'Environment Art', description: '3D Arenas, rings, backgrounds' },
      { id: '10114', name: 'UI & Icons', description: 'Interface graphics & store icons' },
      { id: '10115', name: 'Animation & Rigging', description: 'Character rigs and motion' }
    ],
    priorities: [
      { id: '1', name: 'Highest' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' },
      { id: '4', name: 'Low' },
      { id: '5', name: 'Lowest' }
    ],
    defaultIssueTypeId: '10011',
    defaultIssueTypeName: 'Story',
    requiredFields: {
      '10011': ['summary', 'issuetype', 'project'],
      '10012': ['summary', 'issuetype', 'project']
    },
    lastRefreshedAt: new Date().toISOString()
  },
  MAYHEM: {
    projectId: '10002',
    projectKey: 'MAYHEM',
    projectName: 'WWE Champions & Mayhem Core',
    issueTypes: [
      { id: '10021', name: 'Story', description: 'Feature or Champion Release', subtask: false },
      { id: '10022', name: 'Task', description: 'Game build & content task', subtask: false },
      { id: '10023', name: 'Bug', description: 'Gameplay or visual issue', subtask: false }
    ],
    fixVersions: [
      { id: '10221', name: 'v2.8.0', released: false, archived: false },
      { id: '10222', name: 'v2.9.0', released: false, archived: false },
      { id: '10223', name: 'SummerSlam Live', released: false, archived: false }
    ],
    components: [
      { id: '10121', name: 'Superstars', description: 'Wrestler models & textures' },
      { id: '10122', name: 'Arenas', description: 'Stage sets and lighting' },
      { id: '10123', name: 'LiveOps Events', description: 'Event banners and store packs' }
    ],
    priorities: [
      { id: '1', name: 'Highest' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' },
      { id: '4', name: 'Low' },
      { id: '5', name: 'Lowest' }
    ],
    defaultIssueTypeId: '10021',
    defaultIssueTypeName: 'Story',
    requiredFields: {
      '10021': ['summary', 'issuetype', 'project']
    },
    lastRefreshedAt: new Date().toISOString()
  }
};

// Helper: Fetch project metadata from Jira REST API or fallback
async function fetchJiraProjectMetadata(
  projectKey: string,
  credentials?: { hostUrl?: string; email?: string; apiToken?: string }
): Promise<any> {
  const normKey = (projectKey || '').trim().toUpperCase();
  const fallback = DEFAULT_JIRA_PROJECT_METADATA[normKey] || {
    projectKey: normKey,
    projectName: `Project ${normKey}`,
    issueTypes: [
      { id: '10001', name: 'Story', description: 'User Story', subtask: false },
      { id: '10002', name: 'Task', description: 'Standard Task', subtask: false },
      { id: '10004', name: 'Bug', description: 'Defect', subtask: false }
    ],
    fixVersions: [
      { id: '10201', name: 'Update 98', released: false, archived: false },
      { id: '10202', name: 'Update 99', released: false, archived: false }
    ],
    components: [
      { id: '10101', name: '2D Art', description: '2D Art assets' },
      { id: '10102', name: '3D', description: '3D assets' },
      { id: '10103', name: 'UI', description: 'UI layouts' }
    ],
    priorities: [
      { id: '1', name: 'Highest' },
      { id: '2', name: 'High' },
      { id: '3', name: 'Medium' },
      { id: '4', name: 'Low' }
    ],
    defaultIssueTypeId: '10001',
    defaultIssueTypeName: 'Story',
    requiredFields: {},
    lastRefreshedAt: new Date().toISOString()
  };

  const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(credentials || {});
  if (!rawHost || !rawEmail || !rawToken) {
    return fallback;
  }

  try {
    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    // Fetch Project Details (Issue Types, Components, Versions)
    let projectData: any = null;
    for (const ver of ['3', '2']) {
      try {
        const pRes = await fetch(`${base}/rest/api/${ver}/project/${normKey}`, {
          method: 'GET',
          headers: { 'Authorization': auth, 'Accept': 'application/json' }
        });
        if (pRes.ok) {
          projectData = await pRes.json();
          break;
        }
      } catch (e) {}
    }

    if (!projectData) {
      return fallback;
    }

    // Parse issue types
    let issueTypes = Array.isArray(projectData.issueTypes)
      ? projectData.issueTypes.map((it: any) => ({
          id: String(it.id),
          name: it.name,
          description: it.description || '',
          subtask: Boolean(it.subtask),
          iconUrl: it.iconUrl
        }))
      : [];

    if (issueTypes.length === 0) {
      issueTypes = fallback.issueTypes;
    }

    // Parse components
    let components = Array.isArray(projectData.components)
      ? projectData.components.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          description: c.description || '',
          lead: c.lead ? { name: c.lead.displayName || c.lead.name, email: c.lead.emailAddress } : undefined
        }))
      : [];

    if (components.length === 0 && fallback.components) {
      components = fallback.components;
    }

    // Parse versions
    let fixVersions = Array.isArray(projectData.versions)
      ? projectData.versions.map((v: any) => ({
          id: String(v.id),
          name: v.name,
          description: v.description || '',
          archived: Boolean(v.archived),
          released: Boolean(v.released),
          releaseDate: v.releaseDate
        }))
      : [];

    if (fixVersions.length === 0 && fallback.fixVersions) {
      fixVersions = fallback.fixVersions;
    }

    // Determine default Issue Type
    const defaultType = issueTypes.find((it: any) => !it.subtask && it.name.toLowerCase() === 'story') ||
      issueTypes.find((it: any) => !it.subtask && it.name.toLowerCase() === 'task') ||
      issueTypes.find((it: any) => !it.subtask) ||
      issueTypes[0];

    // Try fetching Createmeta for required and allowed screen fields
    const requiredFields: Record<string, string[]> = {};
    const allowedFields: Record<string, string[]> = {};
    let detectedStoryPointsFieldId: string | undefined = undefined;

    for (const ver of ['3', '2']) {
      try {
        const metaRes = await fetch(`${base}/rest/api/${ver}/issue/createmeta?projectKeys=${normKey}&expand=projects.issuetypes.fields`, {
          method: 'GET',
          headers: { 'Authorization': auth, 'Accept': 'application/json' }
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const projMeta = metaData.projects?.[0];
          if (projMeta?.issuetypes) {
            for (const it of projMeta.issuetypes) {
              const reqKeys: string[] = [];
              const allKeys: string[] = [];
              if (it.fields) {
                for (const [fKey, fVal] of Object.entries(it.fields as any)) {
                  allKeys.push(fKey);
                  if ((fVal as any).required) {
                    reqKeys.push(fKey);
                  }
                  const fName = String((fVal as any).name || '').toLowerCase();
                  if (
                    fName.includes('story point') || 
                    fName === 'story points' || 
                    fName === 'story point estimate' || 
                    fKey === 'customfield_10016'
                  ) {
                    detectedStoryPointsFieldId = fKey;
                  }
                }
              }
              const itIdStr = String(it.id);
              requiredFields[itIdStr] = reqKeys;
              allowedFields[itIdStr] = allKeys;
            }
            break;
          }
        }
      } catch (e) {}
    }

    const result = {
      projectId: projectData.id ? String(projectData.id) : fallback.projectId,
      projectKey: normKey,
      projectName: projectData.name || fallback.projectName,
      issueTypes,
      fixVersions,
      components,
      priorities: fallback.priorities,
      defaultIssueTypeId: defaultType ? String(defaultType.id) : fallback.defaultIssueTypeId,
      defaultIssueTypeName: defaultType ? defaultType.name : fallback.defaultIssueTypeName,
      requiredFields,
      allowedFields,
      storyPointsFieldId: detectedStoryPointsFieldId,
      lastRefreshedAt: new Date().toISOString()
    };

    // Update in-memory fallback cache
    DEFAULT_JIRA_PROJECT_METADATA[normKey] = result;
    return result;
  } catch (err: any) {
    console.warn(`Error fetching Jira metadata for ${normKey}:`, err.message);
    return fallback;
  }
}

// 1.5 Fetch All Accessible Jira Projects
app.post('/api/jira/projects', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira credentials are not configured.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    const projRes = await fetch(`${base}/rest/api/3/project`, {
      method: 'GET',
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    });

    if (!projRes.ok) {
      const v2Res = await fetch(`${base}/rest/api/2/project`, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      if (v2Res.ok) {
        const projects = await v2Res.json();
        return res.json({ success: true, projects });
      }
      return res.status(projRes.status).json({ success: false, error: 'Failed to fetch Jira projects' });
    }

    const projects = await projRes.json();
    return res.json({
      success: true,
      projects: Array.isArray(projects) ? projects.map((p: any) => ({
        id: p.id,
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey,
        avatarUrl: p.avatarUrls?.['48x48'] || p.avatarUrls?.['32x32']
      })) : []
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch Jira projects.' });
  }
});

// 1.6 Dynamic Jira Project Metadata Endpoint (Issue Types, Fix Versions, Components, Priorities)
app.post('/api/jira/project-metadata', async (req, res) => {
  try {
    const projectKey = req.body.projectKey || req.body.jiraProjectKey || 'WWE';
    const metadata = await fetchJiraProjectMetadata(projectKey, req.body);
    return res.json({
      success: true,
      metadata
    });
  } catch (err: any) {
    console.error('Error in /api/jira/project-metadata:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve project metadata.' });
  }
});

// 1.7 Batch Jira Project Metadata Endpoint (for all configured project keys)
app.post('/api/jira/project-meta-batch', async (req, res) => {
  try {
    const rawKeys = req.body.projectKeys || req.body.keys || ['WWE', 'ART', 'MAYHEM'];
    const keysArray = Array.isArray(rawKeys)
      ? rawKeys
      : String(rawKeys).split(',').map(k => String(k || '').trim()).filter(Boolean);

    const results: Record<string, any> = {};
    for (const k of keysArray) {
      const normKey = String(k || '').trim().toUpperCase();
      if (normKey) {
        results[normKey] = await fetchJiraProjectMetadata(normKey, req.body);
      }
    }

    return res.json({
      success: true,
      metadata: results
    });
  } catch (err: any) {
    console.error('Error in /api/jira/project-meta-batch:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to retrieve batch project metadata.' });
  }
});

// Robust Jira Sprint, Parent, and Fix Version Parsers
function parseJiraSprint(fields: any): { sprintName?: string; sprintId?: string; sprintNumber?: number } {
  if (!fields) return {};

  const candidates: any[] = [];
  if (fields.sprint) candidates.push(fields.sprint);
  if (fields.customfield_10020) candidates.push(fields.customfield_10020);
  if (fields.customfield_10000) candidates.push(fields.customfield_10000);

  // Scan all fields for sprint arrays, objects, or greenhopper strings
  for (const [k, val] of Object.entries(fields)) {
    if (!val) continue;
    if (k.toLowerCase().includes('sprint') || k.startsWith('customfield_')) {
      if (Array.isArray(val) && val.length > 0) {
        const item = val[0];
        if (
          (typeof item === 'object' && item !== null && ('name' in item || 'boardId' in item || 'rapidViewId' in item || 'state' in item)) ||
          (typeof item === 'string' && item.includes('com.atlassian.greenhopper.service.sprint.Sprint'))
        ) {
          candidates.push(val);
        }
      } else if (
        (typeof val === 'object' && val !== null && ('name' in val || 'state' in val)) ||
        (typeof val === 'string' && val.includes('com.atlassian.greenhopper.service.sprint.Sprint'))
      ) {
        candidates.push(val);
      }
    }
  }

  for (const cand of candidates) {
    let list: any[] = [];
    if (Array.isArray(cand)) list = cand;
    else if (cand) list = [cand];
    if (list.length === 0) continue;

    // Prefer active sprint, or fallback to the last sprint in the list
    let chosen: any = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const itm = list[i];
      if (typeof itm === 'object' && itm !== null) {
        if ((itm.state || '').toUpperCase() === 'ACTIVE') {
          chosen = itm;
          break;
        }
      } else if (typeof itm === 'string') {
        if (itm.includes('state=ACTIVE')) {
          chosen = itm;
          break;
        }
      }
    }
    if (!chosen) chosen = list[list.length - 1];

    let sprintName: string | undefined = undefined;
    let sprintId: string | undefined = undefined;

    if (typeof chosen === 'object' && chosen !== null) {
      sprintName = chosen.name;
      sprintId = chosen.id ? String(chosen.id) : undefined;
    } else if (typeof chosen === 'string') {
      const nMatch = chosen.match(/name=([^,\]]+)/);
      if (nMatch) sprintName = nMatch[1].trim();
      const idMatch = chosen.match(/id=([^,\]]+)/);
      if (idMatch) sprintId = idMatch[1].trim();
    }

    if (sprintName || sprintId) {
      let sprintNumber: number | undefined = undefined;
      if (sprintName) {
        const numMatch = sprintName.match(/(\d+)/);
        if (numMatch) sprintNumber = parseInt(numMatch[1], 10);
      }
      return { sprintName, sprintId, sprintNumber };
    }
  }

  return {};
}

function parseJiraParent(issue: any, fields: any): { parentKey?: string; parentSummary?: string; parentId?: string; parentType?: string } {
  if (!fields) return {};

  let parentKey: string | undefined = undefined;
  let parentSummary: string | undefined = undefined;
  let parentId: string | undefined = undefined;
  let parentType: string | undefined = undefined;

  // 1. Direct fields.parent (Jira Cloud / modern Jira hierarchy)
  if (fields.parent) {
    parentKey = fields.parent.key;
    parentId = fields.parent.id ? String(fields.parent.id) : undefined;
    parentSummary = fields.parent.fields?.summary || fields.parent.summary;
    parentType = fields.parent.fields?.issuetype?.name || fields.parent.issuetype?.name || 'Parent';
  }

  // 2. Direct issue.parent (some Jira API shapes)
  if (!parentKey && issue?.parent) {
    parentKey = issue.parent.key;
    parentId = issue.parent.id ? String(issue.parent.id) : undefined;
    parentSummary = issue.parent.fields?.summary || issue.parent.summary;
    parentType = issue.parent.fields?.issuetype?.name || issue.parent.issuetype?.name || 'Parent';
  }

  // 3. Epic field (Jira Cloud Agile)
  if (!parentKey && fields.epic) {
    if (typeof fields.epic === 'string') {
      parentKey = fields.epic;
      parentType = 'Epic';
    } else if (typeof fields.epic === 'object' && fields.epic !== null) {
      parentKey = fields.epic.key;
      parentSummary = fields.epic.name || fields.epic.summary;
      parentType = 'Epic';
    }
  }

  // 4. Custom fields (e.g. customfield_10014, customfield_10008, or any customfield with issue key)
  if (!parentKey) {
    for (const [k, val] of Object.entries(fields)) {
      if (!val) continue;
      if (k.toLowerCase().includes('epic') || k.toLowerCase().includes('parent') || k.startsWith('customfield_')) {
        if (typeof val === 'string') {
          const m = val.trim().match(/^([A-Z0-9]+-\d+)(?:\s+(.*))?$/i);
          if (m && (k === 'customfield_10014' || k === 'customfield_10008' || k === 'customfield_10006' || k.toLowerCase().includes('epic') || k.toLowerCase().includes('parent'))) {
            parentKey = m[1].toUpperCase();
            if (m[2]) parentSummary = m[2].trim();
            parentType = 'Epic';
            break;
          }
        } else if (typeof val === 'object' && val !== null && (val as any).key) {
          parentKey = (val as any).key;
          parentSummary = (val as any).name || (val as any).summary;
          parentType = 'Epic';
          break;
        }
      }
    }
  }

  // 5. Check issue links for Epic / Parent relationship
  if (!parentKey && Array.isArray(fields.issuelinks)) {
    for (const link of fields.issuelinks) {
      const typeName = (link.type?.name || '').toLowerCase();
      const inward = link.inwardIssue;
      const outward = link.outwardIssue;
      if (typeName.includes('epic') || typeName.includes('parent') || typeName.includes('part of')) {
        const target = inward || outward;
        if (target?.key) {
          parentKey = target.key;
          parentId = target.id ? String(target.id) : undefined;
          parentSummary = target.fields?.summary || target.summary;
          parentType = target.fields?.issuetype?.name || 'Parent';
          break;
        }
      }
    }
  }

  return { parentKey, parentSummary, parentId, parentType };
}

function parseJiraFixVersions(fields: any, parentSummary?: string): { fixVersion?: string; fixVersions: string[] } {
  if (!fields) return { fixVersions: [] };

  const versionsList: string[] = [];

  if (Array.isArray(fields.fixVersions)) {
    for (const fv of fields.fixVersions) {
      if (typeof fv === 'string' && fv.trim()) {
        versionsList.push(fv.trim());
      } else if (fv && typeof fv === 'object') {
        const name = fv.name || fv.id;
        if (name) versionsList.push(String(name).trim());
      }
    }
  }

  if (versionsList.length === 0 && fields.fixVersion) {
    if (typeof fields.fixVersion === 'string' && fields.fixVersion.trim()) {
      versionsList.push(fields.fixVersion.trim());
    } else if (typeof fields.fixVersion === 'object' && fields.fixVersion?.name) {
      versionsList.push(String(fields.fixVersion.name).trim());
    }
  }

  if (versionsList.length === 0 && Array.isArray(fields.versions)) {
    for (const v of fields.versions) {
      if (typeof v === 'string' && v.trim()) {
        versionsList.push(v.trim());
      } else if (typeof v === 'object' && v?.name) {
        versionsList.push(String(v.name).trim());
      }
    }
  }

  // Fallback: check parent summary (e.g. "Update_94_Game Show Event" -> "Update 94")
  if (versionsList.length === 0 && parentSummary) {
    const pMatch = parentSummary.match(/(?:Update|Ver|v)[_ -]?(\d+(?:\.\d+)?)/i);
    if (pMatch) {
      versionsList.push(`Update ${pMatch[1]}`);
    }
  }

  return { fixVersion: versionsList[0], fixVersions: versionsList };
}

// 2. Fetch / Search Jira Issues (Multi-Project Sync & Lead Proxy)
app.post('/api/jira/search-issues', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken, projectKeys: rawKeys } = resolveJiraCredentials(req.body);
    const { jqlQuery, maxResults = 100, fetchAllAssignees, assigneeFilter } = req.body;

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira credentials are not configured in Studio Settings.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    // Build JQL Query with exclusion rules for completed/verified tasks (Requirement 369)
    const exclusionClause = 'statusCategory != Done AND status NOT IN ("Done", "Completed", "Verified", "Resolved", "Closed", "Approved")';
    
    // Dynamic assignee filter (Requirements 357-360, 362-365)
    let targetAssigneeJql = '';
    if (fetchAllAssignees || (Array.isArray(assigneeFilter) && assigneeFilter.includes('ALL'))) {
      targetAssigneeJql = ''; // No assignee restriction, fetch all
    } else if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0) {
      const clauses: string[] = [];
      const namedAssignees = assigneeFilter.filter((a: string) => a !== 'UNASSIGNED' && a !== 'ALL');
      if (namedAssignees.length > 0) {
        clauses.push(`assignee in (${namedAssignees.map((a: string) => `"${a}"`).join(',')})`);
      }
      if (assigneeFilter.includes('UNASSIGNED')) {
        clauses.push('assignee IS EMPTY');
      }
      targetAssigneeJql = clauses.length > 0 ? `(${clauses.join(' OR ')})` : '';
    } else {
      // Default: Target core artists Ranjeet Patil & Pramod Jadhav, current user, or unassigned for triage
      targetAssigneeJql = '(assignee in ("ranjeet.patil@zapak.com", "ranjeet.patil", "pramod.jadhav@zapak.com", "pramod.jadhav", currentUser()) OR assignee = currentUser() OR assignee IS EMPTY)';
    }

    let finalJql = (jqlQuery || '').trim();
    if (!finalJql) {
      const parts: string[] = [];
      if (rawKeys && rawKeys.trim() && rawKeys.trim().toUpperCase() !== 'ALL') {
        const keys = rawKeys.split(',').map((k: string) => k.trim()).filter(Boolean);
        if (keys.length > 0) {
          parts.push(`project in (${keys.map((k: string) => `"${k}"`).join(',')})`);
        }
      }
      if (targetAssigneeJql) {
        parts.push(targetAssigneeJql);
      }
      parts.push(exclusionClause);

      finalJql = `${parts.join(' AND ')} ORDER BY updated DESC`;
    }

    const searchBody = {
      jql: finalJql,
      maxResults: Math.min(100, Math.max(1, Number(maxResults))),
      fields: [
        '*all',
        'summary',
        'description',
        'issuetype',
        'status',
        'priority',
        'assignee',
        'reporter',
        'project',
        'duedate',
        'timetracking',
        'timeoriginalestimate',
        'timeestimate',
        'timespent',
        'created',
        'updated',
        'labels',
        'components',
        'fixVersions',
        'parent',
        'issuelinks',
        'customfield_10014', // Epic Link in classic Jira
        'customfield_10020', // Sprint field in Jira Cloud
        'customfield_10000', // Alternative Sprint field
        'customfield_10008', // Epic Link in Jira Server
        'customfield_10006',
        'customfield_10005',
        'customfield_10007',
        'customfield_10016', // common Story Points field
        'customfield_10026', // alternative Story Points
        'customfield_10028',
        'customfield_10030',
        'customfield_10100'
      ]
    };

    // Try search endpoints: New Atlassian API v3 JQL endpoint, then GET v3 JQL, then v2 search
    const endpointsToTry = [
      { url: `${base}/rest/api/3/search/jql`, method: 'POST', body: JSON.stringify(searchBody) },
      { 
        url: `${base}/rest/api/3/search/jql?jql=${encodeURIComponent(finalJql)}&maxResults=${searchBody.maxResults}&fields=*all`, 
        method: 'GET', 
        body: undefined 
      },
      { url: `${base}/rest/api/2/search`, method: 'POST', body: JSON.stringify(searchBody) },
      { 
        url: `${base}/rest/api/2/search?jql=${encodeURIComponent(finalJql)}&maxResults=${searchBody.maxResults}&fields=*all`, 
        method: 'GET', 
        body: undefined 
      }
    ];

    let successData: any = null;
    let lastErrorStatus = 500;
    let lastErrorText = '';

    for (const attempt of endpointsToTry) {
      try {
        const fetchOptions: RequestInit = {
          method: attempt.method,
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        };
        if (attempt.body) {
          fetchOptions.body = attempt.body;
        }

        const jiraRes = await fetch(attempt.url, fetchOptions);
        if (jiraRes.ok) {
          successData = await jiraRes.json();
          break;
        } else {
          lastErrorStatus = jiraRes.status;
          lastErrorText = await jiraRes.text();
        }
      } catch (err: any) {
        lastErrorText = err.message || 'Network error';
      }
    }

    if (!successData) {
      return res.status(lastErrorStatus).json({
        success: false,
        error: `Jira search error (${lastErrorStatus}): ${lastErrorText}`
      });
    }

    const rawIssues = successData.issues || successData.results || [];

    const issues = rawIssues
      .map((issue: any) => {
        const fields = issue.fields || {};
        
        // Extract story points from standard or custom fields
        let sp: number | undefined = undefined;
        if (typeof fields.customfield_10016 === 'number') sp = fields.customfield_10016;
        else if (typeof fields.customfield_10026 === 'number') sp = fields.customfield_10026;
        else if (typeof fields.customfield_10028 === 'number') sp = fields.customfield_10028;

        // Extract time tracking in hours (Jira returns seconds)
        const originalSec = fields.timetracking?.originalEstimateSeconds ?? fields.timeoriginalestimate;
        const remainingSec = fields.timetracking?.remainingEstimateSeconds ?? fields.timeestimate;
        const spentSec = fields.timetracking?.timeSpentSeconds ?? fields.timespent;

        const originalHours = originalSec ? Math.round((originalSec / 3600) * 10) / 10 : (sp ? sp * 2 : 8);
        const remainingHours = remainingSec ? Math.round((remainingSec / 3600) * 10) / 10 : originalHours;
        const spentHours = spentSec ? Math.round((spentSec / 3600) * 10) / 10 : 0;

        // Parse sprint information with deep fallback
        const { sprintName, sprintId, sprintNumber } = parseJiraSprint(fields);

        // Parse Jira Parent / Epic from ticket with deep fallback
        const { parentKey, parentSummary, parentId, parentType } = parseJiraParent(issue, fields);

        // Parse Fix Versions from ticket with deep fallback
        const { fixVersion: primaryFixVersion, fixVersions: fixVersionsList } = parseJiraFixVersions(fields, parentSummary);

        // Parse Update No. from summary, labels, or customfields
        let updateNo: string | undefined = undefined;
        const summaryText = fields.summary || '';
        const summaryUpdateMatch = summaryText.match(/(?:Update|U|Ver|v)\s*[-#:]?\s*(\d+(?:\.\d+)?)/i);
        if (summaryUpdateMatch) {
          updateNo = summaryUpdateMatch[1];
        }

        const labelsList: string[] = Array.isArray(fields.labels) ? fields.labels : [];
        if (!updateNo) {
          for (const label of labelsList) {
            const labelMatch = label.match(/(?:update|u)[-_]?(\d+(?:\.\d+)?)/i);
            if (labelMatch) {
              updateNo = labelMatch[1];
              break;
            }
          }
        }

        if (!updateNo && fields.customfield_10030) {
          updateNo = String(fields.customfield_10030);
        }

        // Parse rich or plain text description
        let descText = '';
        if (typeof fields.description === 'string') {
          descText = fields.description;
        } else if (fields.description?.content) {
          try {
            const extractAdf = (node: any): string => {
              if (node.text) return node.text;
              if (node.content && Array.isArray(node.content)) {
                return node.content.map(extractAdf).join(' ');
              }
              return '';
            };
            descText = extractAdf(fields.description);
          } catch (e) {
            descText = 'Imported from Jira';
          }
        }

        const statusName = fields.status?.name || 'To Do';
        const statusCat = fields.status?.statusCategory?.name || 'To Do';
        const assigneeEmail = fields.assignee?.emailAddress || undefined;
        const assigneeDisplayName = fields.assignee?.displayName || (fields.assignee ? 'Assigned' : 'Unassigned');
        const assigneeAccountId = fields.assignee?.accountId || fields.assignee?.name || fields.assignee?.key || undefined;
        const reporterAccountId = fields.reporter?.accountId || fields.reporter?.name || fields.reporter?.key || undefined;

        const componentsList: string[] = Array.isArray(fields.components)
          ? fields.components.map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean)
          : [];
        const primaryComponent = componentsList[0] || undefined;

        return {
          id: issue.id,
          key: issue.key,
          summary: fields.summary || 'Untitled Jira Issue',
          description: descText,
          issueType: fields.issuetype?.name || 'Task',
          status: statusName,
          statusCategory: statusCat,
          priority: fields.priority?.name || 'Medium',
          assigneeName: assigneeDisplayName,
          assigneeEmail: assigneeEmail,
          assigneeAccountId,
          reporterName: fields.reporter?.displayName || 'Unknown Reporter',
          reporterEmail: fields.reporter?.emailAddress || undefined,
          reporterAccountId,
          storyPoints: sp,
          originalEstimateHours: originalHours,
          remainingEstimateHours: remainingHours,
          timeSpentHours: spentHours,
          sprintName,
          sprintNumber,
          sprintId: sprintId ? String(sprintId) : undefined,
          fixVersion: primaryFixVersion,
          fixVersions: fixVersionsList,
          component: primaryComponent,
          components: componentsList,
          parentKey,
          parentSummary,
          parentId,
          parentType,
          updateNo,
          labels: labelsList,
          dueDate: fields.duedate || undefined,
          createdDate: fields.created ? fields.created.split('T')[0] : undefined,
          updatedDate: fields.updated ? fields.updated.split('T')[0] : undefined,
          projectKey: fields.project?.key || 'JIRA',
          projectName: fields.project?.name || fields.project?.key || 'Jira Project',
          url: `${base}/browse/${issue.key}`
        };
      })
      // Rule 4: Exclude Completed and Verified Jira tasks
      .filter((i: any) => {
        const s = (i.status || '').toLowerCase();
        const cat = (i.statusCategory || '').toLowerCase();
        if (s === 'completed' || s === 'verified' || s === 'done' || s === 'resolved' || s === 'closed' || s === 'approved' || cat === 'done') {
          return false;
        }
        return true;
      });

    return res.json({
      success: true,
      total: successData.total || issues.length,
      jql: finalJql,
      issues
    });
  } catch (err: any) {
    console.error('Jira search issues error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to search Jira issues.' });
  }
});

// 2.2 Fetch a Single Jira Issue by Key
app.post('/api/jira/get-issue', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    const targetKey = req.body.jiraIssueKey || req.body.issueKey;

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira credentials are not configured in Studio Settings.' });
    }

    if (!targetKey) {
      return res.status(400).json({ error: 'jiraIssueKey is required.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    let issueData: any = null;
    let lastErrorStatus = 500;
    let lastErrorText = '';

    for (const ver of ['3', '2']) {
      try {
        let issueRes = await fetch(
          `${base}/rest/api/${ver}/issue/${encodeURIComponent(targetKey)}?fields=*all`,
          {
            headers: {
              'Authorization': auth,
              'Accept': 'application/json'
            }
          }
        );

        if (!issueRes.ok) {
          // Fallback to default fields endpoint if *all is rejected
          issueRes = await fetch(
            `${base}/rest/api/${ver}/issue/${encodeURIComponent(targetKey)}`,
            {
              headers: {
                'Authorization': auth,
                'Accept': 'application/json'
              }
            }
          );
        }

        if (issueRes.ok) {
          issueData = await issueRes.json();
          break;
        } else {
          lastErrorStatus = issueRes.status;
          lastErrorText = await issueRes.text();
        }
      } catch (err: any) {
        lastErrorText = err.message || 'Network error';
      }
    }

    if (!issueData || !issueData.fields) {
      return res.status(lastErrorStatus).json({
        success: false,
        error: `Failed to fetch Jira issue (${lastErrorStatus}): ${lastErrorText}`
      });
    }

    const fields = issueData.fields || {};

    let sp: number | undefined = undefined;
    if (typeof fields.customfield_10016 === 'number') sp = fields.customfield_10016;
    else if (typeof fields.customfield_10026 === 'number') sp = fields.customfield_10026;
    else if (typeof fields.customfield_10028 === 'number') sp = fields.customfield_10028;

    const originalSec = fields.timetracking?.originalEstimateSeconds ?? fields.timeoriginalestimate;
    const remainingSec = fields.timetracking?.remainingEstimateSeconds ?? fields.timeestimate;
    const spentSec = fields.timetracking?.timeSpentSeconds ?? fields.timespent;

    const originalHours = originalSec ? Math.round((originalSec / 3600) * 10) / 10 : (sp ? sp * 2 : 8);
    const remainingHours = remainingSec ? Math.round((remainingSec / 3600) * 10) / 10 : originalHours;
    const spentHours = spentSec ? Math.round((spentSec / 3600) * 10) / 10 : 0;

    // Parse sprint information with deep fallback
    const { sprintName, sprintId, sprintNumber } = parseJiraSprint(fields);

    // Parse Jira Parent / Epic from ticket with deep fallback
    const { parentKey, parentSummary, parentId, parentType } = parseJiraParent(issueData, fields);

    // Parse Fix Versions from ticket with deep fallback
    const { fixVersion: primaryFixVersion, fixVersions: fixVersionsList } = parseJiraFixVersions(fields, parentSummary);

    let updateNo: string | undefined = undefined;
    const summaryText = fields.summary || '';
    const summaryUpdateMatch = summaryText.match(/(?:Update|U|Ver|v)\s*[-#:]?\s*(\d+(?:\.\d+)?)/i);
    if (summaryUpdateMatch) {
      updateNo = summaryUpdateMatch[1];
    }

    const labelsList: string[] = Array.isArray(fields.labels) ? fields.labels : [];
    if (!updateNo) {
      for (const label of labelsList) {
        const labelMatch = label.match(/(?:update|u)[-_]?(\d+(?:\.\d+)?)/i);
        if (labelMatch) {
          updateNo = labelMatch[1];
          break;
        }
      }
    }

    if (!updateNo && fields.customfield_10030) {
      updateNo = String(fields.customfield_10030);
    }

    let descText = '';
    if (typeof fields.description === 'string') {
      descText = fields.description;
    } else if (fields.description?.content) {
      try {
        const extractAdf = (node: any): string => {
          if (node.text) return node.text;
          if (node.content && Array.isArray(node.content)) {
            return node.content.map(extractAdf).join(' ');
          }
          return '';
        };
        descText = extractAdf(fields.description);
      } catch (e) {
        descText = 'Imported from Jira';
      }
    }

    const statusName = fields.status?.name || 'To Do';
    const statusCat = fields.status?.statusCategory?.name || 'To Do';
    const assigneeEmail = fields.assignee?.emailAddress || undefined;
    const assigneeDisplayName = fields.assignee?.displayName || (fields.assignee ? 'Assigned' : 'Unassigned');
    const assigneeAccountId = fields.assignee?.accountId || fields.assignee?.name || fields.assignee?.key || undefined;
    const reporterAccountId = fields.reporter?.accountId || fields.reporter?.name || fields.reporter?.key || undefined;

    const componentsList: string[] = Array.isArray(fields.components)
      ? fields.components.map((c: any) => typeof c === 'string' ? c : c?.name).filter(Boolean)
      : [];
    const primaryComponent = componentsList[0] || undefined;

    const parsedIssue = {
      id: issueData.id,
      key: issueData.key,
      summary: fields.summary || 'Untitled Jira Issue',
      description: descText,
      issueType: fields.issuetype?.name || 'Task',
      status: statusName,
      statusCategory: statusCat,
      priority: fields.priority?.name || 'Medium',
      assigneeName: assigneeDisplayName,
      assigneeEmail: assigneeEmail,
      assigneeAccountId,
      reporterName: fields.reporter?.displayName || 'Unknown Reporter',
      reporterEmail: fields.reporter?.emailAddress || undefined,
      reporterAccountId,
      storyPoints: sp,
      originalEstimateHours: originalHours,
      remainingEstimateHours: remainingHours,
      timeSpentHours: spentHours,
      sprintName,
      sprintNumber,
      sprintId,
      fixVersion: primaryFixVersion,
      fixVersions: fixVersionsList,
      component: primaryComponent,
      components: componentsList,
      parentKey,
      parentSummary,
      parentId,
      parentType,
      updateNo,
      labels: labelsList,
      dueDate: fields.duedate || undefined,
      createdDate: fields.created ? fields.created.split('T')[0] : undefined,
      updatedDate: fields.updated ? fields.updated.split('T')[0] : undefined,
      projectKey: fields.project?.key || 'JIRA',
      projectName: fields.project?.name || fields.project?.key || 'Jira Project',
      url: `${base}/browse/${issueData.key}`
    };

    return res.json({
      success: true,
      issue: parsedIssue
    });
  } catch (err: any) {
    console.error('Jira get issue error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to get Jira issue.' });
  }
});

// 2.25 Fetch Assignable Jira Users for Project / User Selection (Requirements 362-365)
app.post('/api/jira/assignable-users', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken, projectKeys: rawKeys } = resolveJiraCredentials(req.body);
    const targetProject = (req.body.projectKey || (rawKeys ? rawKeys.split(',')[0].trim() : 'WWE')).toUpperCase();

    const fallbackUsers = [
      {
        accountId: 'jira-ranjeet-patil',
        displayName: 'Ranjeet Patil',
        emailAddress: 'ranjeet.patil@zapak.com',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
      },
      {
        accountId: 'jira-pramod-jadhav',
        displayName: 'Pramod Jadhav',
        emailAddress: 'pramod.jadhav@zapak.com',
        active: true,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
      },
      {
        accountId: 'jira-lead-proxy',
        displayName: 'WWE Art Lead',
        emailAddress: rawEmail || 'wwemayhemgame@gmail.com',
        active: true
      }
    ];

    if (!rawHost || !rawEmail || !rawToken) {
      return res.json({
        success: true,
        source: 'seed',
        users: fallbackUsers
      });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    let rawUsers: any[] = [];
    for (const ver of ['3', '2']) {
      try {
        const uRes = await fetch(`${base}/rest/api/${ver}/user/assignable/search?project=${encodeURIComponent(targetProject)}&maxResults=100`, {
          headers: { 'Authorization': auth, 'Accept': 'application/json' }
        });
        if (uRes.ok) {
          const list = await uRes.json();
          if (Array.isArray(list) && list.length > 0) {
            rawUsers = list;
            break;
          }
        }
      } catch (e) {}
    }

    if (rawUsers.length === 0) {
      // Try search endpoint
      try {
        const sRes = await fetch(`${base}/rest/api/3/users/search?maxResults=50`, {
          headers: { 'Authorization': auth, 'Accept': 'application/json' }
        });
        if (sRes.ok) {
          const list = await sRes.json();
          if (Array.isArray(list) && list.length > 0) {
            rawUsers = list;
          }
        }
      } catch (e) {}
    }

    if (rawUsers.length > 0) {
      const sanitized: Array<{
        accountId: string;
        displayName: string;
        emailAddress?: string;
        active: boolean;
        avatarUrl?: string;
      }> = rawUsers.map((u: any) => ({
        accountId: u.accountId || u.name || u.key,
        displayName: u.displayName || u.name || 'Jira User',
        emailAddress: u.emailAddress || undefined,
        active: u.active !== false,
        avatarUrl: u.avatarUrls?.['48x48'] || u.avatarUrls?.['32x32'] || undefined
      })).filter(u => u.accountId);

      // Ensure Ranjeet Patil and Pramod Jadhav are included if missing
      for (const def of fallbackUsers) {
        if (!sanitized.some(u => u.displayName.toLowerCase() === def.displayName.toLowerCase())) {
          sanitized.push(def);
        }
      }

      return res.json({
        success: true,
        source: 'jira',
        users: sanitized
      });
    }

    return res.json({
      success: true,
      source: 'fallback',
      users: fallbackUsers
    });
  } catch (err: any) {
    return res.json({
      success: true,
      source: 'fallback_error',
      users: [
        {
          accountId: 'jira-ranjeet-patil',
          displayName: 'Ranjeet Patil',
          emailAddress: 'ranjeet.patil@zapak.com',
          active: true
        },
        {
          accountId: 'jira-pramod-jadhav',
          displayName: 'Pramod Jadhav',
          emailAddress: 'pramod.jadhav@zapak.com',
          active: true
        }
      ]
    });
  }
});

// 2.3 Create a New Issue in Jira (Push from Studio Task)
app.post('/api/jira/create-issue', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    const {
      projectKey,
      summary,
      description,
      issueType,
      issueTypeId,
      fixVersion,
      fixVersionId,
      fixVersions,
      component,
      componentId,
      components,
      priority = 'Medium',
      dueDate,
      originalEstimateHours,
      storyPoints,
      artistName,
      assigneeAccountId,
      assigneeName,
      labels
    } = req.body;

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira credentials are not configured in Studio Settings.' });
    }

    if (!projectKey || !summary) {
      return res.status(400).json({ error: 'projectKey and summary are required to create a Jira issue.' });
    }

    const normKey = projectKey.trim().toUpperCase();
    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    // Fetch project metadata to resolve valid Issue Type IDs, Fix Versions, Components
    const projMeta = await fetchJiraProjectMetadata(normKey, req.body);

    // Sanitize issueType: ensure Studio workflow status is NEVER sent as Jira issuetype
    const workflowStatusNames = [
      'TO DO', 'IN PROGRESS', 'ON HOLD', 'RE-OPENED', 'SUBMIT FOR REVIEW',
      'IN ITERATION', 'COMPLETED', 'CANCELLED', 'DONE', 'CLOSED', 'TODO'
    ];
    let sanitizedType = (issueType || '').trim();
    if (workflowStatusNames.includes(sanitizedType.toUpperCase())) {
      sanitizedType = '';
    }

    // Resolve Jira Issue Type ID
    let resolvedIssueTypeId = '';
    let resolvedIssueTypeName = '';

    if (issueTypeId && projMeta.issueTypes.some((it: any) => String(it.id) === String(issueTypeId))) {
      resolvedIssueTypeId = String(issueTypeId);
      resolvedIssueTypeName = projMeta.issueTypes.find((it: any) => String(it.id) === String(issueTypeId))?.name || '';
    } else if (sanitizedType) {
      const match = projMeta.issueTypes.find(
        (it: any) => it.name.toLowerCase() === sanitizedType.toLowerCase()
      );
      if (match) {
        resolvedIssueTypeId = String(match.id);
        resolvedIssueTypeName = match.name;
      }
    }

    // Fallback if no match found
    if (!resolvedIssueTypeId) {
      if (projMeta.defaultIssueTypeId) {
        resolvedIssueTypeId = String(projMeta.defaultIssueTypeId);
        resolvedIssueTypeName = projMeta.defaultIssueTypeName || 'Story';
      } else if (projMeta.issueTypes && projMeta.issueTypes.length > 0) {
        const standard = projMeta.issueTypes.find((it: any) => !it.subtask) || projMeta.issueTypes[0];
        resolvedIssueTypeId = String(standard.id);
        resolvedIssueTypeName = standard.name;
      } else {
        resolvedIssueTypeId = '10001';
        resolvedIssueTypeName = 'Story';
      }
    }

    const descText = description || (artistName ? `Created from RG ArtFlow Studio for ${artistName}` : 'Created from RG ArtFlow Studio');

    // Build payload with Issue Type ID (preferred by Jira)
    const fieldsPayloadV2: any = {
      project: { key: normKey },
      summary: summary.trim(),
      description: descText,
      issuetype: resolvedIssueTypeId ? { id: resolvedIssueTypeId } : { name: resolvedIssueTypeName || 'Story' }
    };

    // Priority
    if (priority) {
      fieldsPayloadV2.priority = { name: priority };
    }

    // Due Date
    if (dueDate) {
      fieldsPayloadV2.duedate = dueDate;
    }

    // Labels
    if (labels && Array.isArray(labels) && labels.length > 0) {
      fieldsPayloadV2.labels = labels;
    }

    // Fix Versions
    const collectedFixVersions: any[] = [];
    if (fixVersionId) {
      collectedFixVersions.push({ id: String(fixVersionId) });
    } else if (fixVersion && typeof fixVersion === 'string') {
      const matchedVer = projMeta.fixVersions?.find(
        (v: any) => v.name.toLowerCase() === fixVersion.toLowerCase() || String(v.id) === String(fixVersion)
      );
      if (matchedVer) {
        collectedFixVersions.push({ id: String(matchedVer.id) });
      } else {
        collectedFixVersions.push({ name: fixVersion.trim() });
      }
    } else if (Array.isArray(fixVersions) && fixVersions.length > 0) {
      for (const fv of fixVersions) {
        if (typeof fv === 'string') {
          const matchedVer = projMeta.fixVersions?.find(
            (v: any) => v.name.toLowerCase() === fv.toLowerCase() || String(v.id) === String(fv)
          );
          if (matchedVer) {
            collectedFixVersions.push({ id: String(matchedVer.id) });
          } else {
            collectedFixVersions.push({ name: fv.trim() });
          }
        } else if (fv && typeof fv === 'object' && fv.id) {
          collectedFixVersions.push({ id: String(fv.id) });
        }
      }
    }

    // If no fixVersion was supplied, check if project/issueType mandates it or has available versions
    if (collectedFixVersions.length === 0) {
      const isFixVerRequired = projMeta.requiredFields?.[resolvedIssueTypeId]?.includes('fixVersions') ||
        projMeta.requiredFields?.[resolvedIssueTypeId]?.includes('versions') ||
        normKey === 'WWE' ||
        (Array.isArray(projMeta.fixVersions) && projMeta.fixVersions.length > 0);
      
      if (isFixVerRequired && projMeta.fixVersions && projMeta.fixVersions.length > 0) {
        const defaultVer = projMeta.fixVersions.find((v: any) => !v.released && !v.archived) || projMeta.fixVersions[0];
        if (defaultVer && defaultVer.id) {
          collectedFixVersions.push({ id: String(defaultVer.id) });
        }
      }
    }

    if (collectedFixVersions.length > 0) {
      fieldsPayloadV2.fixVersions = collectedFixVersions;
    }

    // Components
    const collectedComponents: any[] = [];
    if (componentId) {
      collectedComponents.push({ id: String(componentId) });
    } else if (component && typeof component === 'string') {
      const matchedComp = projMeta.components?.find(
        (c: any) => c.name.toLowerCase() === component.toLowerCase() || String(c.id) === String(component)
      );
      if (matchedComp) {
        collectedComponents.push({ id: String(matchedComp.id) });
      } else {
        collectedComponents.push({ name: component.trim() });
      }
    } else if (Array.isArray(components) && components.length > 0) {
      for (const comp of components) {
        if (typeof comp === 'string') {
          const matchedComp = projMeta.components?.find(
            (c: any) => c.name.toLowerCase() === comp.toLowerCase() || String(c.id) === String(comp)
          );
          if (matchedComp) {
            collectedComponents.push({ id: String(matchedComp.id) });
          } else {
            collectedComponents.push({ name: comp.trim() });
          }
        } else if (comp && typeof comp === 'object' && comp.id) {
          collectedComponents.push({ id: String(comp.id) });
        }
      }
    }

    // If no component was supplied, check if project/issueType mandates it or has available components
    if (collectedComponents.length === 0) {
      const isCompRequired = projMeta.requiredFields?.[resolvedIssueTypeId]?.includes('components') ||
        normKey === 'WWE' ||
        (Array.isArray(projMeta.components) && projMeta.components.length > 0);

      if (isCompRequired && projMeta.components && projMeta.components.length > 0) {
        const defaultComp = projMeta.components.find((c: any) => 
          c.name.toLowerCase().includes('art') || 
          c.name.toLowerCase().includes('ui') || 
          c.name.toLowerCase().includes('2d')
        ) || projMeta.components[0];
        if (defaultComp && defaultComp.id) {
          collectedComponents.push({ id: String(defaultComp.id) });
        }
      }
    }

    if (collectedComponents.length > 0) {
      fieldsPayloadV2.components = collectedComponents;
    }

    // Assignee (Requirement 366)
    if (assigneeAccountId) {
      fieldsPayloadV2.assignee = { accountId: assigneeAccountId };
    } else if (assigneeName && assigneeName !== 'Unassigned') {
      fieldsPayloadV2.assignee = { name: assigneeName };
    }

    // Original Estimate
    if (originalEstimateHours && originalEstimateHours > 0) {
      fieldsPayloadV2.timetracking = {
        originalEstimate: `${originalEstimateHours}h`,
        remainingEstimate: `${originalEstimateHours}h`
      };
    }

    // Filter fields against screen schema if createmeta returned screen info
    const screenAllowed = projMeta.allowedFields?.[resolvedIssueTypeId] || [];
    const hasScreenInfo = Array.isArray(screenAllowed) && screenAllowed.length > 0;

    if (hasScreenInfo) {
      if (fieldsPayloadV2.duedate && !screenAllowed.includes('duedate')) {
        delete fieldsPayloadV2.duedate;
      }
      if (fieldsPayloadV2.timetracking && !screenAllowed.includes('timetracking')) {
        delete fieldsPayloadV2.timetracking;
      }
      if (fieldsPayloadV2.fixVersions && !screenAllowed.includes('fixVersions') && normKey !== 'WWE') {
        delete fieldsPayloadV2.fixVersions;
      }
      if (fieldsPayloadV2.components && !screenAllowed.includes('components') && normKey !== 'WWE') {
        delete fieldsPayloadV2.components;
      }
      if (fieldsPayloadV2.labels && !screenAllowed.includes('labels')) {
        delete fieldsPayloadV2.labels;
      }
      if (fieldsPayloadV2.priority && !screenAllowed.includes('priority')) {
        delete fieldsPayloadV2.priority;
      }
    }

    // Story Points: ONLY include if field ID is confirmed on the target issue type create screen
    const targetSpField = projMeta.storyPointsFieldId || 'customfield_10016';
    if (storyPoints && Number(storyPoints) > 0) {
      if (hasScreenInfo) {
        if (screenAllowed.includes(targetSpField) || (projMeta.storyPointsFieldId && screenAllowed.includes(projMeta.storyPointsFieldId))) {
          fieldsPayloadV2[targetSpField] = Number(storyPoints);
        }
      }
      // If no screen info is available, DO NOT add customfield_10016 speculatively to avoid screen rejection
    }

    let createdData: any = null;
    let lastErrorStatus = 500;
    let lastErrorText = '';
    const omittedFields: string[] = [];

    // Attempt creation with V2 and V3 REST endpoints
    for (const ver of ['2', '3']) {
      try {
        let bodyToSend: any = { fields: fieldsPayloadV2 };
        if (ver === '3') {
          bodyToSend = {
            fields: {
              ...fieldsPayloadV2,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: descText
                      }
                    ]
                  }
                ]
              }
            }
          };
        }

        const createRes = await fetch(`${base}/rest/api/${ver}/issue`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(bodyToSend)
        });

        if (createRes.ok) {
          createdData = await createRes.json();
          break;
        } else {
          lastErrorStatus = createRes.status;
          lastErrorText = await createRes.text();
        }
      } catch (e: any) {
        lastErrorText = e.message || 'Network error';
      }
    }

    // Auto-Recovery Retry Loop: If Jira rejected due to non-screen / uneditable / invalid fields or issuetype, strip offending fields and retry
    let retryAttempts = 0;
    while (!createdData && retryAttempts < 4) {
      let rejectedFieldsFound = false;
      const rejectedFieldNames = new Set<string>();

      // Parse JSON errors
      let parsed: any = null;
      try {
        parsed = JSON.parse(lastErrorText);
        if (parsed && parsed.errors && typeof parsed.errors === 'object') {
          for (const key of Object.keys(parsed.errors)) {
            rejectedFieldNames.add(key);
          }
        }
      } catch (e) {}

      // Regex matching for field rejection patterns
      const fieldRegexes = [
        /Field '([^']+)' cannot be set/gi,
        /'([^']+)' is not on the appropriate screen/gi,
        /cannot set '([^']+)'/gi,
        /Field '([^']+)' is not editable/gi,
        /Field '([^']+)' does not exist/gi,
        /cannot be set for field '([^']+)'/gi
      ];

      for (const regex of fieldRegexes) {
        let match;
        while ((match = regex.exec(lastErrorText)) !== null) {
          if (match[1]) {
            rejectedFieldNames.add(match[1]);
          }
        }
      }

      // Check if issuetype was rejected
      if (lastErrorText.toLowerCase().includes('issuetype') || rejectedFieldNames.has('issuetype')) {
        try {
          const liveProjRes = await fetch(`${base}/rest/api/2/project/${normKey}`, {
            headers: { 'Authorization': auth, 'Accept': 'application/json' }
          });
          if (liveProjRes.ok) {
            const liveData = await liveProjRes.json();
            const liveIssueTypes = liveData.issueTypes || [];
            const validStandard = liveIssueTypes.find((it: any) => !it.subtask && String(it.id) !== String(fieldsPayloadV2.issuetype?.id)) || liveIssueTypes[0];
            if (validStandard && validStandard.id) {
              fieldsPayloadV2.issuetype = { id: String(validStandard.id) };
              resolvedIssueTypeId = String(validStandard.id);
              resolvedIssueTypeName = validStandard.name;
              rejectedFieldsFound = true;
              rejectedFieldNames.delete('issuetype');
            }
          }
        } catch (e) {}
      }

      // Check if components are required by Jira
      const lowerError = lastErrorText.toLowerCase();
      if (
        lowerError.includes('components is required') ||
        lowerError.includes('components: components is required') ||
        (parsed && parsed.errors && typeof parsed.errors.components === 'string' && parsed.errors.components.toLowerCase().includes('required'))
      ) {
        rejectedFieldNames.delete('components');
        let chosenComp = projMeta.components?.find((c: any) => 
          c.name.toLowerCase().includes('art') || c.name.toLowerCase().includes('ui') || c.name.toLowerCase().includes('2d')
        ) || projMeta.components?.[0];

        if (!chosenComp) {
          try {
            const liveCompRes = await fetch(`${base}/rest/api/2/project/${normKey}/components`, {
              headers: { 'Authorization': auth, 'Accept': 'application/json' }
            });
            if (liveCompRes.ok) {
              const liveComps = await liveCompRes.json();
              if (Array.isArray(liveComps) && liveComps.length > 0) {
                chosenComp = liveComps[0];
              }
            }
          } catch (e) {}
        }

        if (chosenComp) {
          fieldsPayloadV2.components = [{ id: String(chosenComp.id) }];
          rejectedFieldsFound = true;
        }
      }

      // Check if fixVersions are required by Jira
      if (
        lowerError.includes('fix versions is required') ||
        lowerError.includes('fix versions: fix versions is required') ||
        lowerError.includes('fixversions is required') ||
        (parsed && parsed.errors && typeof parsed.errors.fixVersions === 'string' && parsed.errors.fixVersions.toLowerCase().includes('required'))
      ) {
        rejectedFieldNames.delete('fixVersions');
        let chosenVer = projMeta.fixVersions?.find((v: any) => !v.released && !v.archived) || projMeta.fixVersions?.[0];

        if (!chosenVer) {
          try {
            const liveVerRes = await fetch(`${base}/rest/api/2/project/${normKey}/versions`, {
              headers: { 'Authorization': auth, 'Accept': 'application/json' }
            });
            if (liveVerRes.ok) {
              const liveVers = await liveVerRes.json();
              if (Array.isArray(liveVers) && liveVers.length > 0) {
                chosenVer = liveVers.find((v: any) => !v.released && !v.archived) || liveVers[0];
              }
            }
          } catch (e) {}
        }

        if (chosenVer) {
          fieldsPayloadV2.fixVersions = [{ id: String(chosenVer.id) }];
          rejectedFieldsFound = true;
        }
      }

      if (rejectedFieldNames.size > 0) {
        for (const f of rejectedFieldNames) {
          if (fieldsPayloadV2[f] !== undefined) {
            delete fieldsPayloadV2[f];
            omittedFields.push(f);
            rejectedFieldsFound = true;
          }
        }
      }

      if (!rejectedFieldsFound) {
        break;
      }

      retryAttempts++;
      // Retry creation with stripped fields
      for (const ver of ['2', '3']) {
        try {
          let bodyToSend: any = { fields: fieldsPayloadV2 };
          if (ver === '3') {
            bodyToSend = {
              fields: {
                ...fieldsPayloadV2,
                description: {
                  type: 'doc',
                  version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: descText }] }]
                }
              }
            };
          }

          const retryRes = await fetch(`${base}/rest/api/${ver}/issue`, {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(bodyToSend)
          });

          if (retryRes.ok) {
            createdData = await retryRes.json();
            break;
          } else {
            lastErrorStatus = retryRes.status;
            lastErrorText = await retryRes.text();
          }
        } catch (e: any) {
          lastErrorText = e.message || 'Network error';
        }
      }
    }

    if (!createdData || !createdData.key) {
      let parsedErrorDetail = lastErrorText;
      let errorSummary = `Failed to create Jira issue (${lastErrorStatus})`;
      try {
        const parsed = JSON.parse(lastErrorText);
        if (parsed.errorMessages && parsed.errorMessages.length > 0) {
          parsedErrorDetail = parsed.errorMessages.join(', ');
        } else if (parsed.errors) {
          parsedErrorDetail = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join('; ');
        }
      } catch {
        // use raw text
      }

      if (lastErrorStatus === 400) {
        errorSummary = `Jira rejected the request for project "${normKey}". ${parsedErrorDetail || 'Please verify project key and issue fields.'}`;
      } else if (lastErrorStatus === 401 || lastErrorStatus === 403) {
        errorSummary = `Authentication or permission error for project "${normKey}". Connected Jira account (${cleanEmail}) does not have issue creation permissions in this project.`;
      } else if (lastErrorStatus === 404) {
        errorSummary = `Jira project "${normKey}" was not found on your Jira workspace.`;
      }

      return res.status(lastErrorStatus).json({
        success: false,
        error: errorSummary,
        rawError: parsedErrorDetail,
        projectKey: normKey
      });
    }

    return res.json({
      success: true,
      key: createdData.key,
      id: createdData.id,
      self: createdData.self,
      issueType: resolvedIssueTypeName,
      issueTypeId: resolvedIssueTypeId,
      url: `${base}/browse/${createdData.key}`
    });
  } catch (err: any) {
    console.error('Jira create issue error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to push task to Jira.' });
  }
});

// 2.5 Fetch Available Transitions & Issue Details for a Specific Jira Issue Key
app.post('/api/jira/issue-transitions', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    const targetKey = req.body.jiraIssueKey || req.body.issueKey;

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira credentials are not configured in Studio Settings.' });
    }

    if (!targetKey) {
      return res.status(400).json({ error: 'jiraIssueKey is required.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    // 1. Fetch current issue details
    let issueDetails: any = null;
    try {
      const issueRes = await fetch(`${base}/rest/api/3/issue/${targetKey}?fields=summary,status,priority,assignee,timetracking,components,fixVersions,duedate`, {
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      if (issueRes.ok) {
        issueDetails = await issueRes.json();
      }
    } catch (e) {}

    // 2. Fetch transitions
    let transitions: any[] = [];
    for (const ver of ['3', '2']) {
      try {
        const transRes = await fetch(`${base}/rest/api/${ver}/issue/${targetKey}/transitions?expand=transitions.fields`, {
          headers: { 'Authorization': auth, 'Accept': 'application/json' }
        });
        if (transRes.ok) {
          const transData = await transRes.json();
          transitions = transData.transitions || [];
          if (transitions.length > 0) break;
        }
      } catch (e) {}
    }

    const formattedTransitions = transitions.map((t: any) => ({
      id: t.id,
      name: t.name,
      to: {
        id: t.to?.id,
        name: t.to?.name || t.name,
        category: t.to?.statusCategory?.name || 'To Do',
        colorName: t.to?.statusCategory?.colorName || 'blue-gray'
      },
      hasScreen: Boolean(t.hasScreen),
      isGlobal: Boolean(t.isGlobal)
    }));

    return res.json({
      success: true,
      jiraIssueKey: targetKey,
      currentStatus: issueDetails?.fields?.status?.name || 'Unknown',
      statusCategory: issueDetails?.fields?.status?.statusCategory?.name || 'To Do',
      timetracking: issueDetails?.fields?.timetracking || null,
      assignee: issueDetails?.fields?.assignee?.displayName || null,
      transitions: formattedTransitions
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch Jira transitions.' });
  }
});

// 3. Two-Way Push: Sync Task Updates (Worklog, Status Transition, Time Remaining, Story Points, Due Date, Artist Comment)
app.post('/api/jira/sync-task-update', async (req, res) => {
  try {
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    const {
      jiraIssueKey,
      artistName,
      hoursLogged,
      remainingEstimateHours,
      remainingEstimateText,
      worklogDescription,
      worklogDate,
      storyPoints,
      dueDate,
      priority,
      issueType,
      issueTypeId,
      fixVersion,
      fixVersionId,
      fixVersions,
      component,
      componentId,
      components,
      statusName,
      transitionId,
      customComment,
      assigneeAccountId,
      assigneeName,
      syncOptions = {}
    } = req.body;

    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ error: 'Jira integration credentials are not configured on this studio app. Please save credentials in Settings.' });
    }

    if (!jiraIssueKey) {
      return res.status(400).json({ error: 'jiraIssueKey is required.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);
    const effectiveArtist = artistName || 'Studio Artist';
    const logResults: {
      worklogAdded?: boolean;
      commentAdded?: boolean;
      fieldsUpdated?: boolean;
      statusTransitioned?: boolean;
      timetrackingUpdated?: boolean;
      currentJiraStatus?: string;
      warnings?: string[];
    } = { warnings: [] };

    // Fetch current issue state (status, timetracking)
    let currentJiraStatusName = '';
    let currentStatusCategory = '';
    try {
      const issueRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}?fields=status,timetracking`, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
      if (issueRes.ok) {
        const issueData = await issueRes.json();
        currentJiraStatusName = issueData.fields?.status?.name || '';
        currentStatusCategory = issueData.fields?.status?.statusCategory?.name || '';
        logResults.currentJiraStatus = currentJiraStatusName;
      }
    } catch (e) {}

    // A. Direct Fields Update (Issue Type, Fix Versions, Components, Due Date, Priority, Story Points)
    const updateFields: any = {};
    if (dueDate) {
      updateFields.duedate = dueDate;
    }
    if (priority) {
      updateFields.priority = { name: priority };
    }
    if (issueTypeId) {
      updateFields.issuetype = { id: String(issueTypeId) };
    }
    if (fixVersionId || fixVersion || (Array.isArray(fixVersions) && fixVersions.length > 0)) {
      const fvList: any[] = [];
      if (fixVersionId) fvList.push({ id: String(fixVersionId) });
      else if (fixVersion) fvList.push({ name: fixVersion });
      else if (Array.isArray(fixVersions)) {
        for (const f of fixVersions) {
          if (typeof f === 'string') fvList.push({ name: f });
          else if (f?.id) fvList.push({ id: String(f.id) });
        }
      }
      if (fvList.length > 0) updateFields.fixVersions = fvList;
    }
    if (componentId || component || (Array.isArray(components) && components.length > 0)) {
      const cList: any[] = [];
      if (componentId) cList.push({ id: String(componentId) });
      else if (component) cList.push({ name: component });
      else if (Array.isArray(components)) {
        for (const c of components) {
          if (typeof c === 'string') cList.push({ name: c });
          else if (c?.id) cList.push({ id: String(c.id) });
        }
      }
      if (cList.length > 0) updateFields.components = cList;
    }
    if (storyPoints !== undefined && Number(storyPoints) > 0) {
      updateFields.customfield_10016 = Number(storyPoints);
    }

    if (Object.keys(updateFields).length > 0) {
      try {
        for (const ver of ['3', '2']) {
          const putRes = await fetch(`${base}/rest/api/${ver}/issue/${jiraIssueKey}`, {
            method: 'PUT',
            headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ fields: updateFields })
          });
          if (putRes.ok || putRes.status === 204) {
            logResults.fieldsUpdated = true;
            break;
          } else {
            const putErrText = await putRes.text();
            // If rejected due to customfield_10016 or other field, strip and retry
            let strippedAny = false;
            try {
              const parsed = JSON.parse(putErrText);
              if (parsed.errors) {
                for (const k of Object.keys(parsed.errors)) {
                  if (updateFields[k] !== undefined) {
                    delete updateFields[k];
                    strippedAny = true;
                  }
                }
              }
            } catch (e) {}

            if (putErrText.includes('customfield_10016') && updateFields.customfield_10016 !== undefined) {
              delete updateFields.customfield_10016;
              strippedAny = true;
            }

            if (strippedAny && Object.keys(updateFields).length > 0) {
              const retryPut = await fetch(`${base}/rest/api/${ver}/issue/${jiraIssueKey}`, {
                method: 'PUT',
                headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ fields: updateFields })
              });
              if (retryPut.ok || retryPut.status === 204) {
                logResults.fieldsUpdated = true;
                break;
              }
            }
          }
        }
      } catch (fErr: any) {
        logResults.warnings?.push(`Fields update note: ${fErr.message}`);
      }
    }

    // A2. Assignee Synchronization (Requirement 366)
    if (assigneeAccountId !== undefined || assigneeName !== undefined) {
      try {
        let assigneePayload: any = null;
        if (assigneeAccountId) {
          assigneePayload = { accountId: assigneeAccountId };
        } else if (assigneeName && assigneeName !== 'Unassigned') {
          assigneePayload = { name: assigneeName };
        } else {
          assigneePayload = { accountId: null };
        }

        for (const ver of ['3', '2']) {
          const assRes = await fetch(`${base}/rest/api/${ver}/issue/${encodeURIComponent(jiraIssueKey)}/assignee`, {
            method: 'PUT',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(assigneePayload)
          });
          if (assRes.ok || assRes.status === 204) {
            logResults.fieldsUpdated = true;
            break;
          }
        }
      } catch (err: any) {
        logResults.warnings?.push(`Assignee update warning: ${err.message}`);
      }
    }

    // A. Add Worklog to Jira (attributed to lead account with artist attribution note)
    if (hoursLogged && Number(hoursLogged) > 0) {
      const timeSpentSeconds = Math.max(60, Math.round(Number(hoursLogged) * 3600));
      const hoursNum = Number(hoursLogged);
      const formattedTimeSpent = hoursNum < 1 
        ? `${Math.round(hoursNum * 60)}m` 
        : `${Math.floor(hoursNum)}h ${Math.round((hoursNum % 1) * 60) ? Math.round((hoursNum % 1) * 60) + 'm' : ''}`.trim();

      const logDateObj = worklogDate ? new Date(worklogDate) : new Date();
      // Format as ISO with +0000: YYYY-MM-DDTHH:mm:ss.000+0000
      const startedStr = logDateObj.toISOString().replace('Z', '+0000');

      const artistNote = `[RG ArtFlow Worklog - ${effectiveArtist}]: ${worklogDescription || `Logged ${formattedTimeSpent} (${hoursLogged}h)`}`;

      // Calculate remaining seconds if provided
      let adjustParam = 'adjustEstimate=auto';
      if (remainingEstimateHours !== undefined && Number(remainingEstimateHours) >= 0) {
        const remainingSec = Math.round(Number(remainingEstimateHours) * 3600);
        adjustParam = `adjustEstimate=new&newEstimate=${remainingSec}s`;
      }

      // 1. Try Jira API v3 Worklog endpoint
      const v3WorklogBody = {
        timeSpentSeconds,
        started: startedStr,
        comment: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: artistNote }]
            }
          ]
        }
      };

      // 2. Fallback v2 Worklog endpoint
      const v2WorklogBody = {
        timeSpentSeconds,
        timeSpent: formattedTimeSpent,
        started: startedStr,
        comment: artistNote
      };

      let worklogSuccess = false;
      const worklogEndpoints = [
        { url: `${base}/rest/api/3/issue/${jiraIssueKey}/worklog?${adjustParam}`, body: JSON.stringify(v3WorklogBody) },
        { url: `${base}/rest/api/2/issue/${jiraIssueKey}/worklog?${adjustParam}`, body: JSON.stringify(v2WorklogBody) },
        { url: `${base}/rest/api/3/issue/${jiraIssueKey}/worklog`, body: JSON.stringify({ timeSpentSeconds, started: startedStr }) }
      ];

      for (const wAttempt of worklogEndpoints) {
        try {
          const wlRes = await fetch(wAttempt.url, {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: wAttempt.body
          });

          if (wlRes.ok) {
            logResults.worklogAdded = true;
            worklogSuccess = true;
            break;
          }
        } catch (wErr: any) {
          // continue fallback
        }
      }

      if (!worklogSuccess) {
        logResults.warnings?.push('Could not post time worklog directly to Jira time tracking. Log note will be visible in comments.');
      }
    }

    // B. Direct Remaining Estimate / Timetracking Update
    if (remainingEstimateHours !== undefined && Number(remainingEstimateHours) >= 0 && !logResults.worklogAdded) {
      try {
        const remHours = Number(remainingEstimateHours);
        const remFormatted = remHours < 1 ? `${Math.round(remHours * 60)}m` : `${Math.floor(remHours)}h ${Math.round((remHours % 1) * 60) ? Math.round((remHours % 1) * 60) + 'm' : ''}`.trim();
        const ttPayload = {
          fields: {
            timetracking: {
              remainingEstimate: remFormatted || `${remHours}h`
            }
          }
        };

        const ttRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}`, {
          method: 'PUT',
          headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(ttPayload)
        });

        if (ttRes.ok) {
          logResults.timetrackingUpdated = true;
        }
      } catch (ttErr: any) {
        // silent fallback
      }
    }

    // C. Transition Workflow Status if Requested (Exact Match or Keyword Match)
    let didTransition = false;
    if (transitionId || statusName) {
      const targetLower = (statusName || '').toLowerCase().replace(/_/g, ' ').trim();
      const currentLower = currentJiraStatusName.toLowerCase().trim();

      // Check if already in target state
      if (!transitionId && currentLower && (
        currentLower === targetLower || 
        (targetLower === 'in progress' && currentLower === 'in progress') || 
        ((targetLower === 'completed' || targetLower === 'done') && (currentLower === 'completed' || currentLower === 'done' || currentLower === 'closed')) ||
        (targetLower === 'on hold' && (currentLower === 'on hold' || currentLower === 'blocked' || currentLower === 'paused'))
      )) {
        logResults.statusTransitioned = true;
        didTransition = true;
      } else {
        try {
          // Fetch available transitions: try v3 first, then v2
          let availableTransitions: any[] = [];
          for (const transVer of ['3', '2']) {
            try {
              const transRes = await fetch(`${base}/rest/api/${transVer}/issue/${jiraIssueKey}/transitions?expand=transitions.fields`, {
                method: 'GET',
                headers: { 'Authorization': auth, 'Accept': 'application/json' }
              });
              if (transRes.ok) {
                const transData = await transRes.json();
                availableTransitions = transData.transitions || [];
                if (availableTransitions.length > 0) break;
              }
            } catch (e) {}
          }

          if (availableTransitions.length > 0) {
            let matchingTrans: any = null;

            // 1. Direct ID match
            if (transitionId) {
              matchingTrans = availableTransitions.find((t: any) => String(t.id) === String(transitionId));
            }

            // 2. Exact or Strict Keyword Multi-Tier Match
            if (!matchingTrans && targetLower) {
              const isDoneTarget = targetLower.includes('complete') || targetLower.includes('done') || targetLower.includes('approv') || targetLower.includes('finish') || targetLower.includes('resolve');
              const isReviewTarget = targetLower.includes('review') || targetLower.includes('submit');
              const isProgressTarget = targetLower.includes('progress') || targetLower.includes('start') || targetLower === 'in_progress';
              const isHoldTarget = targetLower.includes('hold') || targetLower.includes('block') || targetLower.includes('pause');
              const isReopenTarget = targetLower.includes('reopen') || targetLower.includes('re-open') || targetLower.includes('revision');
              const isTodoTarget = targetLower.includes('to do') || targetLower.includes('todo') || targetLower.includes('backlog') || targetLower.includes('selected') || targetLower.includes('open');
              const isCancelTarget = targetLower.includes('cancel') || targetLower.includes('discard') || targetLower.includes('reject');

              // Unwanted cancel / reject keywords to prevent accidental cancellation when attempting to complete
              const isUnwantedCancelOrReject = (nameStr: string) => {
                const s = (nameStr || '').toLowerCase();
                return s.includes('cancel') || s.includes('discard') || s.includes('reject') || s.includes("won't") || s.includes('wont') || s.includes('invalid') || s.includes('abort');
              };

              // Tier 1: Exact Match on Destination Status Name (`to.name`)
              matchingTrans = availableTransitions.find((t: any) => {
                const toName = (t.to?.name || '').toLowerCase().trim();
                if (!toName) return false;
                if (!isCancelTarget && isUnwantedCancelOrReject(toName)) return false;

                if (toName === targetLower) return true;
                if (isDoneTarget && (toName === 'completed' || toName === 'done' || toName === 'approved' || toName === 'resolved' || toName === 'closed')) return true;
                if (isReviewTarget && (toName === 'submit for review' || toName === 'in review' || toName === 'under review' || toName === 'qa review' || toName === 'internal review' || toName === 'ready for review')) return true;
                if (isProgressTarget && (toName === 'in progress' || toName === 'in development' || toName === 'wip')) return true;
                if (isHoldTarget && (toName === 'on hold' || toName === 'blocked' || toName === 'paused')) return true;
                if (isReopenTarget && (toName === 're-opened' || toName === 'reopened' || toName === 'revision' || toName === 'reopen')) return true;
                if (isTodoTarget && (toName === 'to do' || toName === 'todo' || toName === 'backlog' || toName === 'open' || toName === 'selected for development')) return true;
                return false;
              });

              // Tier 2: Exact Match on Transition Action Name (`t.name`)
              if (!matchingTrans) {
                matchingTrans = availableTransitions.find((t: any) => {
                  const tName = (t.name || '').toLowerCase().trim();
                  const toName = (t.to?.name || '').toLowerCase().trim();
                  if (!isCancelTarget && (isUnwantedCancelOrReject(tName) || isUnwantedCancelOrReject(toName))) return false;

                  if (tName === targetLower) return true;
                  if (isDoneTarget && (tName === 'approve issue' || tName === 'approve issue (2)' || tName === 'approve' || tName === 'complete' || tName === 'completed' || tName === 'done' || tName === 'resolve' || tName === 'finish' || tName === 'close')) return true;
                  if (isReviewTarget && (tName === 'submit for review' || tName === 'submit' || tName === 'request review' || tName === 'ready for review')) return true;
                  if (isProgressTarget && (tName === 'start work' || tName === 'start progress' || tName === 'start' || tName === 'begin' || tName === 'in progress' || tName === 'resume')) return true;
                  if (isHoldTarget && (tName === 'on hold' || tName === 'hold' || tName === 'block' || tName === 'pause')) return true;
                  if (isReopenTarget && (tName === 're-opened' || tName === 'reopen' || tName === 're-open' || tName === 'reopen issue')) return true;
                  if (isTodoTarget && (tName === 'to do' || tName === 'todo' || tName === 'stop progress' || tName === 'backlog')) return true;
                  return false;
                });
              }

              // Tier 3: Substring match on Destination Status Name (`to.name`)
              if (!matchingTrans) {
                matchingTrans = availableTransitions.find((t: any) => {
                  const toName = (t.to?.name || '').toLowerCase().trim();
                  if (!toName) return false;
                  if (!isCancelTarget && isUnwantedCancelOrReject(toName)) return false;

                  if (isDoneTarget) {
                    return toName.includes('complete') || toName.includes('done') || toName.includes('approv') || toName.includes('resolv') || toName.includes('finish') || toName.includes('clos');
                  }
                  if (isReviewTarget) {
                    return toName.includes('review') || toName.includes('submit');
                  }
                  if (isProgressTarget) {
                    return toName.includes('progress') || toName.includes('work') || toName.includes('dev');
                  }
                  if (isHoldTarget) {
                    return toName.includes('hold') || toName.includes('block') || toName.includes('pause');
                  }
                  if (isReopenTarget) {
                    return toName.includes('reopen') || toName.includes('re-open') || toName.includes('revis');
                  }
                  if (isTodoTarget) {
                    return toName.includes('to do') || toName.includes('todo') || toName.includes('backlog') || toName.includes('open');
                  }
                  return toName.includes(targetLower);
                });
              }

              // Tier 4: Substring match on Transition Action Name (`t.name`)
              if (!matchingTrans) {
                matchingTrans = availableTransitions.find((t: any) => {
                  const tName = (t.name || '').toLowerCase().trim();
                  const toName = (t.to?.name || '').toLowerCase().trim();
                  if (!isCancelTarget && (isUnwantedCancelOrReject(tName) || isUnwantedCancelOrReject(toName))) return false;

                  if (isDoneTarget) {
                    return tName.includes('complete') || tName.includes('done') || tName.includes('approv') || tName.includes('resolv') || tName.includes('finish') || tName.includes('close');
                  }
                  if (isReviewTarget) {
                    return tName.includes('review') || tName.includes('submit');
                  }
                  if (isProgressTarget) {
                    return tName.includes('start') || tName.includes('progress') || tName.includes('begin') || tName.includes('resume');
                  }
                  if (isHoldTarget) {
                    return tName.includes('hold') || tName.includes('block') || tName.includes('pause');
                  }
                  if (isReopenTarget) {
                    return tName.includes('reopen') || tName.includes('re-open') || tName.includes('revis');
                  }
                  if (isTodoTarget) {
                    return tName.includes('to do') || tName.includes('todo') || tName.includes('backlog');
                  }
                  return tName.includes(targetLower);
                });
              }

              // Tier 5: Safe Status Category Fallback (NEVER allowing cancel or reject)
              if (!matchingTrans && isDoneTarget) {
                matchingTrans = availableTransitions.find((t: any) => {
                  const toCat = (t.to?.statusCategory?.name || t.to?.statusCategory?.key || '').toLowerCase().trim();
                  const tName = (t.name || '').toLowerCase().trim();
                  const toName = (t.to?.name || '').toLowerCase().trim();
                  if (isUnwantedCancelOrReject(tName) || isUnwantedCancelOrReject(toName)) return false;
                  return toCat === 'done';
                });
              }
            }

            if (matchingTrans) {
              // Try posting transition on v3, then v2
              for (const postVer of ['3', '2']) {
                try {
                  const performTransRes = await fetch(`${base}/rest/api/${postVer}/issue/${jiraIssueKey}/transitions`, {
                    method: 'POST',
                    headers: {
                      'Authorization': auth,
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify({ transition: { id: matchingTrans.id } })
                  });

                  if (performTransRes.ok || performTransRes.status === 204) {
                    logResults.statusTransitioned = true;
                    didTransition = true;
                    logResults.currentJiraStatus = matchingTrans.to?.name || matchingTrans.name;
                    break;
                  } else {
                    const transErr = await performTransRes.text();
                    logResults.warnings?.push(`Transition note (v${postVer}): ${transErr}`);
                  }
                } catch (pErr: any) {
                  logResults.warnings?.push(`Transition post error: ${pErr.message}`);
                }
              }
            } else {
              logResults.warnings?.push(`No transition matching "${statusName}" available from current status "${currentJiraStatusName || 'Current'}". Available actions in Jira: ${availableTransitions.map(t => t.name).join(', ')}`);
            }
          }
        } catch (tErr: any) {
          logResults.warnings?.push(`Transition error: ${tErr.message}`);
        }
      }
    }

    // D. Post Artist Attribution Activity Comment (Clean, concise formatting)
    if (syncOptions.addComment !== false && (hoursLogged || (statusName && didTransition) || customComment)) {
      const commentParts: string[] = [];
      
      // If there is a direct custom message or note, lead with it
      if (customComment) {
        commentParts.push(customComment);
      } else if (statusName && didTransition) {
        commentParts.push(`Status updated to *${statusName}* by ${effectiveArtist}`);
      } else if (hoursLogged) {
        commentParts.push(`Logged *${hoursLogged}h* work by ${effectiveArtist}`);
      }

      // Compact metadata bullets (only if there are work logs or estimates)
      const subDetails: string[] = [];
      if (hoursLogged && customComment) {
        subDetails.push(`• Work Logged: ${hoursLogged}h (${worklogDescription || 'Art production'})`);
      }
      if (statusName && didTransition && customComment) {
        subDetails.push(`• Status: ${statusName}`);
      }
      if (remainingEstimateHours !== undefined && hoursLogged) {
        subDetails.push(`• Remaining: ${remainingEstimateHours}h`);
      }

      const commentLines = [
        `[RG ArtFlow] ${commentParts.join('\n')}`,
        ...subDetails
      ].filter(Boolean).join('\n');

      const commentPayload = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentLines
                }
              ]
            }
          ]
        }
      };

      try {
        const cRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/comment`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(commentPayload)
        });
        if (cRes.ok) {
          logResults.commentAdded = true;
        } else {
          // Fallback to v2
          await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}/comment`, {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ body: commentLines })
          });
        }
      } catch (cErr: any) {
        logResults.warnings?.push(`Comment error: ${cErr.message}`);
      }
    }

    // E. Update Issue Fields (Due Date, Story Points)
    const fieldsToUpdate: Record<string, any> = {};
    if (dueDate) {
      fieldsToUpdate.duedate = dueDate;
    }
    if (storyPoints !== undefined && syncOptions.storyPointsFieldId) {
      fieldsToUpdate[syncOptions.storyPointsFieldId] = Number(storyPoints);
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      try {
        const updateRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}`, {
          method: 'PUT',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ fields: fieldsToUpdate })
        });
        if (updateRes.ok) {
          logResults.fieldsUpdated = true;
        } else {
          const uErr = await updateRes.text();
          logResults.warnings?.push(`Field update note: ${uErr}`);
        }
      } catch (uErr: any) {
        logResults.warnings?.push(`Field update error: ${uErr.message}`);
      }
    }

    return res.json({
      success: true,
      jiraIssueKey,
      syncedAt: new Date().toISOString(),
      results: logResults
    });
  } catch (err: any) {
    console.error('Jira sync task update error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to sync update to Jira.' });
  }
});

// Helper for parsing file data URLs, remote URLs, and base64 streams into Buffers
async function extractAttachmentBufferAndMime(
  fileDataUrl: string,
  providedName?: string,
  providedMime?: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  let mimeType = providedMime || 'application/octet-stream';
  let buffer: Buffer;
  let cleanName = (providedName || `artwork_asset_${Date.now()}`).trim();

  if (fileDataUrl.startsWith('http://') || fileDataUrl.startsWith('https://')) {
    const fetchRes = await fetch(fileDataUrl);
    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch media from remote URL: ${fetchRes.statusText}`);
    }
    const ct = fetchRes.headers.get('content-type');
    if (ct) mimeType = ct.split(';')[0].trim();
    const arrayBuf = await fetchRes.arrayBuffer();
    buffer = Buffer.from(arrayBuf);
  } else if (fileDataUrl.startsWith('data:')) {
    const matches = fileDataUrl.match(/^data:([a-zA-Z0-9_.+-]+\/[a-zA-Z0-9_.+-]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      const commaIdx = fileDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = fileDataUrl.slice(0, commaIdx);
        const data = fileDataUrl.slice(commaIdx + 1);
        const m = header.match(/^data:([^;]+)/);
        if (m) mimeType = m[1];
        buffer = Buffer.from(data, 'base64');
      } else {
        buffer = Buffer.from(fileDataUrl);
      }
    }
  } else if (/^[A-Za-z0-9+/=]+$/.test(fileDataUrl) && fileDataUrl.length > 80) {
    buffer = Buffer.from(fileDataUrl, 'base64');
  } else {
    buffer = Buffer.from(fileDataUrl, 'utf-8');
  }

  // Ensure reasonable file extension
  if (!cleanName.includes('.')) {
    if (mimeType.includes('png')) cleanName += '.png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) cleanName += '.jpg';
    else if (mimeType.includes('gif')) cleanName += '.gif';
    else if (mimeType.includes('webp')) cleanName += '.webp';
    else if (mimeType.includes('mp4')) cleanName += '.mp4';
    else if (mimeType.includes('webm')) cleanName += '.webm';
    else if (mimeType.includes('json')) cleanName += '.json';
    else cleanName += '.png';
  }

  return { buffer, mimeType, fileName: cleanName };
}

// 4.5 Upload Attachment / Image directly to a Jira Ticket (Single File)
app.post('/api/jira/upload-attachment', async (req, res) => {
  try {
    const {
      jiraIssueKey,
      fileDataUrl,
      fileName,
      mimeType: requestedMime,
      artistName = 'Studio Artist',
      addComment = true,
      comment
    } = req.body || {};

    if (!jiraIssueKey) {
      return res.status(400).json({ success: false, error: 'jiraIssueKey is required.' });
    }

    if (!fileDataUrl) {
      return res.status(400).json({ success: false, error: 'fileDataUrl or base64 content is required.' });
    }

    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ success: false, error: 'Jira credentials are not configured in Studio Settings.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    // Extract binary buffer & clean filename
    const { buffer, mimeType, fileName: cleanFileName } = await extractAttachmentBufferAndMime(
      fileDataUrl,
      fileName,
      requestedMime
    );

    // Construct multipart form data for Jira REST API
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, cleanFileName);

    // Upload to Jira: POST /rest/api/3/issue/{issueIdOrKey}/attachments
    let uploadResponse = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'X-Atlassian-Token': 'no-check',
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      // Try fallback to /rest/api/2/issue/{issueIdOrKey}/attachments
      uploadResponse = await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'X-Atlassian-Token': 'no-check',
          'Accept': 'application/json'
        },
        body: formData
      });
    }

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      let errorMsg = errText;
      try {
        const j = JSON.parse(errText);
        errorMsg = j.errorMessages?.join(', ') || j.message || errText;
      } catch (e) {}

      return res.status(uploadResponse.status).json({
        success: false,
        error: `Jira attachment upload failed (${uploadResponse.status}): ${errorMsg}`
      });
    }

    const uploadedAttachments = await uploadResponse.json();
    const primaryAttachment = Array.isArray(uploadedAttachments) && uploadedAttachments.length > 0
      ? uploadedAttachments[0]
      : uploadedAttachments;

    let commentAdded = false;
    // Optional: Add Jira comment attributing upload to artist
    if (addComment) {
      const humanSize = (buffer.length / 1024 < 1024)
        ? `${(buffer.length / 1024).toFixed(1)} KB`
        : `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`;

      const commentBodyText = comment
        ? `🎨 [RG ArtFlow Studio - Image Upload by ${artistName}]: Attached file "${cleanFileName}" (${humanSize}).\n\n${comment}`
        : `🎨 [RG ArtFlow Studio - Image Upload by ${artistName}]: Attached file "${cleanFileName}" (${humanSize}) directly to this ticket.`;

      try {
        const commentAdf = {
          version: 1,
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentBodyText
                }
              ]
            }
          ]
        };

        const cRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/comment`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ body: commentAdf })
        });

        if (cRes.ok) {
          commentAdded = true;
        } else {
          // Fallback to v2 plain text comment
          await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}/comment`, {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ body: commentBodyText })
          });
        }
      } catch (cErr) {
        console.warn('Could not add Jira comment for attachment:', cErr);
      }
    }

    return res.json({
      success: true,
      jiraIssueKey,
      fileName: cleanFileName,
      sizeBytes: buffer.length,
      mimeType,
      attachment: primaryAttachment,
      commentAdded,
      uploadedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error uploading attachment to Jira:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload attachment to Jira.' });
  }
});

// 4.6 Upload Multiple Attachments / Batch Upload to Jira
app.post('/api/jira/upload-attachments-batch', async (req, res) => {
  try {
    const {
      jiraIssueKey,
      attachments = [],
      artistName = 'Studio Artist',
      addComment = true
    } = req.body || {};

    if (!jiraIssueKey) {
      return res.status(400).json({ success: false, error: 'jiraIssueKey is required.' });
    }

    if (!Array.isArray(attachments) || attachments.length === 0) {
      return res.status(400).json({ success: false, error: 'attachments array is required.' });
    }

    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ success: false, error: 'Jira credentials are not configured in Studio Settings.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    const uploadedList: any[] = [];
    const failedList: any[] = [];

    for (const item of attachments) {
      try {
        const { buffer, mimeType, fileName: cleanFileName } = await extractAttachmentBufferAndMime(
          item.fileDataUrl || item.url,
          item.fileName || item.name,
          item.mimeType || item.fileType
        );

        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, cleanFileName);

        let uploadRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/attachments`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'X-Atlassian-Token': 'no-check',
            'Accept': 'application/json'
          },
          body: formData
        });

        if (!uploadRes.ok) {
          uploadRes = await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}/attachments`, {
            method: 'POST',
            headers: {
              'Authorization': auth,
              'X-Atlassian-Token': 'no-check',
              'Accept': 'application/json'
            },
            body: formData
          });
        }

        if (uploadRes.ok) {
          const respData = await uploadRes.json();
          const primary = Array.isArray(respData) && respData.length > 0 ? respData[0] : respData;
          uploadedList.push({
            id: item.id,
            fileName: cleanFileName,
            jiraAttachment: primary,
            syncedAt: new Date().toISOString()
          });
        } else {
          const errText = await uploadRes.text();
          failedList.push({
            id: item.id,
            fileName: cleanFileName,
            error: errText
          });
        }
      } catch (itemErr: any) {
        failedList.push({
          id: item.id,
          fileName: item.name || item.fileName,
          error: itemErr.message
        });
      }
    }

    if (addComment && uploadedList.length > 0) {
      try {
        const commentText = `🎨 [RG ArtFlow Studio - Media Batch Upload by ${artistName}]: Uploaded ${uploadedList.length} media file(s) to ticket ${jiraIssueKey}:\n${uploadedList.map(u => `• ${u.fileName}`).join('\n')}`;

        await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/comment`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            body: {
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: commentText }]
                }
              ]
            }
          })
        });
      } catch (cErr) {
        console.warn('Batch attachment comment error:', cErr);
      }
    }

    return res.json({
      success: uploadedList.length > 0,
      jiraIssueKey,
      totalRequested: attachments.length,
      uploadedCount: uploadedList.length,
      uploaded: uploadedList,
      failed: failedList
    });
  } catch (err: any) {
    console.error('Error during batch Jira attachment upload:', err);
    return res.status(500).json({ success: false, error: err.message || 'Batch attachment upload failed.' });
  }
});

// 4.7 Get All Attachments from Jira Ticket
app.post('/api/jira/issue-attachments', async (req, res) => {
  try {
    const { jiraIssueKey } = req.body || {};
    if (!jiraIssueKey) {
      return res.status(400).json({ success: false, error: 'jiraIssueKey is required.' });
    }

    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ success: false, error: 'Jira credentials are not configured.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    let issueRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}?fields=attachment,summary`, {
      method: 'GET',
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    });

    if (!issueRes.ok) {
      issueRes = await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}?fields=attachment,summary`, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': 'application/json' }
      });
    }

    if (!issueRes.ok) {
      const errText = await issueRes.text();
      return res.status(issueRes.status).json({ success: false, error: `Failed to fetch Jira attachments: ${errText}` });
    }

    const issueData = await issueRes.json();
    const attachments = issueData.fields?.attachment || [];

    const formattedAttachments = attachments.map((att: any) => {
      const safeContentUrl = att.content || `${base}/rest/api/3/attachment/content/${att.id}`;
      const safeThumbUrl = att.thumbnail || `${base}/rest/api/3/attachment/thumbnail/${att.id}`;
      const proxyUrl = `/api/jira/attachment-proxy?id=${att.id}&url=${encodeURIComponent(safeContentUrl)}`;
      const proxyThumbnailUrl = att.thumbnail
        ? `/api/jira/attachment-proxy?id=${att.id}&thumb=true&url=${encodeURIComponent(safeThumbUrl)}`
        : proxyUrl;

      return {
        id: String(att.id),
        filename: att.filename,
        author: att.author?.displayName || 'Jira User',
        created: att.created,
        size: att.size,
        mimeType: att.mimeType,
        content: safeContentUrl,
        thumbnail: safeThumbUrl,
        proxyUrl,
        proxyThumbnailUrl
      };
    });

    return res.json({
      success: true,
      jiraIssueKey,
      summary: issueData.fields?.summary,
      attachments: formattedAttachments
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error fetching Jira attachments.' });
  }
});

// 4.8 Proxy Jira Attachment Image/Media Streams Directly to Frontend
app.get('/api/jira/attachment-proxy', async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    const attachmentId = req.query.id as string;
    const isThumbnail = req.query.thumb === 'true';

    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.query);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(401).send('Jira credentials not configured.');
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    let targetUrl = rawUrl;
    if (!targetUrl && attachmentId) {
      targetUrl = isThumbnail
        ? `${base}/rest/api/3/attachment/thumbnail/${attachmentId}`
        : `${base}/rest/api/3/attachment/content/${attachmentId}`;
    }

    if (!targetUrl) {
      return res.status(400).send('Missing url or id parameter');
    }

    if (targetUrl.startsWith('/')) {
      targetUrl = `${base}${targetUrl}`;
    }

    let jiraRes = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': '*/*'
      }
    });

    if (!jiraRes.ok && attachmentId) {
      // Fallback attempt: try v2 or alternative endpoint
      const fallbackUrl = isThumbnail
        ? `${base}/rest/api/2/attachment/thumbnail/${attachmentId}`
        : `${base}/rest/api/2/attachment/content/${attachmentId}`;
      jiraRes = await fetch(fallbackUrl, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': '*/*' }
      });
    }

    if (!jiraRes.ok) {
      return res.status(jiraRes.status).send(`Failed to load Jira media: ${jiraRes.statusText}`);
    }

    const contentType = jiraRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const arrayBuffer = await jiraRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error proxying Jira attachment:', err);
    return res.status(500).send(err.message || 'Error proxying Jira media asset.');
  }
});

// 4.9 Download Jira Attachment and convert to Base64 Data URL for local task storage
app.post('/api/jira/attachment-to-data-url', async (req, res) => {
  try {
    const { attachmentId, contentUrl, jiraIssueKey } = req.body || {};
    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ success: false, error: 'Jira credentials are not configured.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    let targetUrl = contentUrl || (attachmentId ? `${base}/rest/api/3/attachment/content/${attachmentId}` : '');
    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'attachmentId or contentUrl is required.' });
    }

    if (targetUrl.startsWith('/')) {
      targetUrl = `${base}${targetUrl}`;
    }

    let jiraRes = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Authorization': auth, 'Accept': '*/*' }
    });

    if (!jiraRes.ok && attachmentId) {
      jiraRes = await fetch(`${base}/rest/api/2/attachment/content/${attachmentId}`, {
        method: 'GET',
        headers: { 'Authorization': auth, 'Accept': '*/*' }
      });
    }

    if (!jiraRes.ok) {
      return res.status(jiraRes.status).json({ success: false, error: `Failed to download from Jira: ${jiraRes.statusText}` });
    }

    const contentType = jiraRes.headers.get('content-type') || 'image/png';
    const arrayBuffer = await jiraRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Data}`;

    return res.json({
      success: true,
      dataUrl,
      mimeType: contentType,
      sizeBytes: buffer.length
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error converting Jira attachment to data URL.' });
  }
});

// 4.10 Post Direct Studio Comment to Jira Issue
app.post('/api/jira/add-comment', async (req, res) => {
  try {
    const {
      jiraIssueKey,
      comment,
      authorName = 'Studio Artist'
    } = req.body || {};

    if (!jiraIssueKey) {
      return res.status(400).json({ success: false, error: 'jiraIssueKey is required.' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'comment content is required.' });
    }

    const { hostUrl: rawHost, email: rawEmail, apiToken: rawToken } = resolveJiraCredentials(req.body);
    if (!rawHost || !rawEmail || !rawToken) {
      return res.status(400).json({ success: false, error: 'Jira credentials are not configured in Studio Settings.' });
    }

    const base = normalizeJiraUrl(rawHost);
    const { cleanEmail, cleanToken } = cleanJiraCredentials(rawEmail, rawToken);
    const auth = createJiraAuthHeader(cleanEmail, cleanToken);

    const formattedCommentText = `[RG ArtFlow — ${authorName}]\n${comment.trim()}`;

    const commentPayload = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: formattedCommentText
              }
            ]
          }
        ]
      }
    };

    let postRes = await fetch(`${base}/rest/api/3/issue/${jiraIssueKey}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(commentPayload)
    });

    if (!postRes.ok) {
      // Fallback to v2 API
      postRes = await fetch(`${base}/rest/api/2/issue/${jiraIssueKey}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ body: formattedCommentText })
      });
    }

    if (!postRes.ok) {
      const errText = await postRes.text();
      return res.status(postRes.status).json({ success: false, error: `Failed to post comment to Jira: ${errText}` });
    }

    const result = await postRes.json();
    return res.json({
      success: true,
      jiraIssueKey,
      commentId: result.id,
      postedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error posting comment to Jira:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error posting comment to Jira.' });
  }
});

// 4.11 Cloud Media & Storage Asset Management (Replaces inline Base64 storage in Firestore)
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve /uploads directly with 30-day cache
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// POST /api/media/upload - Store image/video files on disk/storage and return lightweight metadata
app.post('/api/media/upload', (req, res) => {
  try {
    const {
      fileName = 'artwork.png',
      fileType = 'image/png',
      fileData,
      taskId,
      uploadedBy = 'Studio User'
    } = req.body || {};

    if (!fileData) {
      return res.status(400).json({ success: false, error: 'No fileData payload provided.' });
    }

    // Extract binary buffer from Base64 or raw string
    let buffer: Buffer;
    if (typeof fileData === 'string' && fileData.includes(';base64,')) {
      const base64Clean = fileData.split(';base64,').pop() || '';
      buffer = Buffer.from(base64Clean, 'base64');
    } else if (typeof fileData === 'string') {
      buffer = Buffer.from(fileData, 'base64');
    } else {
      buffer = Buffer.from(fileData);
    }

    // Generate safe unique filename
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : (fileType.includes('png') ? 'png' : fileType.includes('pdf') ? 'pdf' : 'jpg');
    const cleanBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const destinationPath = path.join(UPLOADS_DIR, uniqueFileName);

    fs.writeFileSync(destinationPath, buffer);

    const sizeBytes = buffer.length;
    const humanSize = sizeBytes < 1024 * 1024
      ? `${(sizeBytes / 1024).toFixed(1)} KB`
      : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

    const storagePath = `/uploads/${uniqueFileName}`;
    const publicUrl = `/uploads/${uniqueFileName}`;

    return res.json({
      success: true,
      media: {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: fileName,
        fileName,
        size: humanSize,
        fileSize: humanSize,
        sizeBytes,
        url: publicUrl,
        storagePath,
        thumbnailPath: publicUrl,
        fileType,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        taskId
      }
    });
  } catch (err: any) {
    console.error('Error handling media upload:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error processing media upload.' });
  }
});

// GET /api/media/audit - Audit stored media files
app.get('/api/media/audit', (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ success: true, files: [], totalSizeBytes: 0, totalFiles: 0 });
    }

    const fileNames = fs.readdirSync(UPLOADS_DIR);
    let totalBytes = 0;
    const files = fileNames.map(name => {
      const filePath = path.join(UPLOADS_DIR, name);
      const stat = fs.statSync(filePath);
      totalBytes += stat.size;
      return {
        name,
        storagePath: `/uploads/${name}`,
        url: `/uploads/${name}`,
        sizeBytes: stat.size,
        sizeHuman: stat.size < 1024 * 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
        createdAt: stat.birthtime.toISOString()
      };
    });

    return res.json({
      success: true,
      totalFiles: files.length,
      totalSizeBytes: totalBytes,
      totalSizeHuman: totalBytes < 1024 * 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
      files
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error auditing media storage.' });
  }
});

// POST /api/media/detect-orphans - Find files on storage not referenced in active tasks
app.post('/api/media/detect-orphans', (req, res) => {
  try {
    const { activeUrls = [] } = req.body || {};
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ success: true, orphans: [], totalOrphanBytes: 0 });
    }

    const activeSet = new Set<string>((Array.isArray(activeUrls) ? activeUrls : []).map((u: any) => String(u || '').toLowerCase().trim()));
    const fileNames = fs.readdirSync(UPLOADS_DIR);
    const orphans: any[] = [];
    let orphanBytes = 0;

    fileNames.forEach(name => {
      const relPath = `/uploads/${name}`.toLowerCase();
      const directUrl = name.toLowerCase();

      let isReferenced = false;
      for (const active of Array.from(activeSet)) {
        if (active.includes(relPath) || active.includes(directUrl)) {
          isReferenced = true;
          break;
        }
      }

      if (!isReferenced) {
        const filePath = path.join(UPLOADS_DIR, name);
        const stat = fs.statSync(filePath);
        orphanBytes += stat.size;
        orphans.push({
          name,
          storagePath: `/uploads/${name}`,
          url: `/uploads/${name}`,
          sizeBytes: stat.size,
          sizeHuman: stat.size < 1024 * 1024 ? `${(stat.size / 1024).toFixed(1)} KB` : `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          createdAt: stat.birthtime.toISOString()
        });
      }
    });

    return res.json({
      success: true,
      totalOrphans: orphans.length,
      totalOrphanBytes: orphanBytes,
      totalOrphanHuman: orphanBytes < 1024 * 1024 ? `${(orphanBytes / 1024).toFixed(1)} KB` : `${(orphanBytes / (1024 * 1024)).toFixed(1)} MB`,
      orphans
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error detecting orphan media.' });
  }
});

// POST /api/media/delete-file - Delete orphan file safely
app.post('/api/media/delete-file', (req, res) => {
  try {
    const { fileName } = req.body || {};
    if (!fileName) {
      return res.status(400).json({ success: false, error: 'fileName is required.' });
    }

    // Prevent directory traversal
    const safeName = path.basename(fileName);
    const targetPath = path.join(UPLOADS_DIR, safeName);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return res.json({ success: true, message: `Removed orphaned media: ${safeName}` });
    } else {
      return res.status(404).json({ success: false, error: 'File not found in media storage.' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error deleting media file.' });
  }
});

// 5. Public API & Published Webhook Info Endpoint
app.get('/api/public/status', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Reliance Games ArtFlow Engine',
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    capabilities: [
      'jira-multi-project-sync',
      'timesheet-worklogs',
      'media-attachments',
      'daily-reports-api'
    ]
  });
});

// Setup Vite dev middleware or static production files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARTOPS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
