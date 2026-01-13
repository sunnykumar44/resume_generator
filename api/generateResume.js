import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Define ratelimit instance OUTSIDE the handler for Vercel performance
const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }),
  limiter: Ratelimit.fixedWindow(20, "1 d"),      // 20 resumes per day
  analytics: true,
  prefix: "@upstash/ratelimit:resume-generator",
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { jobDescription, strategy = "ats", pin } = req.body;

  if (!pin || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: "Unauthorized: Invalid PIN" });
  }

  // 1. Quota Logic Check
  const identifier = pin; 
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: `Daily quota exceeded (20 resumes/day). Try again in ~${retryAfter} minutes.`,
      quota: { remaining: 0, limit, used: limit, reset: new Date(reset).toISOString() }
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using gemini-3-flash-preview for 2026 speed and quality
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on ATS-friendly keywords and clean formatting.",
      faang: "Emphasize scale, ownership, and measurable impact.",
      startup: "Emphasize versatility, speed, and ownership."
    };

    const prompt = `CRITICAL: Output ONLY valid HTML starting with <!DOCTYPE html>. 
    STRICT CONSTRAINT: One page layout (A4). 

    ===== PROFILE =====
    ${JSON.stringify(userProfile)}

    ===== JOB DESCRIPTION =====
    ${jobDescription}

    STRATEGY: ${strategyMap[strategy]}

    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Helvetica', 'Arial', sans-serif; 
        line-height: 1.48; 
        color: #1e293b; 
        max-width: 210mm; 
        margin: 0 auto; 
        padding: 5mm 12mm;
      }
      .split-row { display: flex; justify-content: space-between; align-items: baseline; width: 100%; }
      h2 { font-size: 13px; margin: 16px 0 8px; border-bottom: 1.5px solid #2b6cb0; color: #1a365d; text-transform: uppercase; letter-spacing: 1px; }
      .section { margin-bottom: 12px; font-size: 10.5px; }
      ul { margin-left: 18px; margin-top: 4px; }
      li { margin-bottom: 4px; }
      p { margin-bottom: 4px; }
      .cert-item { margin-bottom: 8px; }
      .cert-name { font-weight: bold; color: #1e293b; font-size: 10.5px; }
      .cert-desc { font-size: 9.5px; color: #64748b; font-style: italic; display: block; }
    </style>
    </head>
    <body>
      <div style="width: 100%; text-align: center !important; margin-top: -2mm; margin-bottom: 18px;">
        <h1 style="font-size: 32px; font-weight: 800; color: #1a365d; text-transform: uppercase; margin-bottom: 2px;">${userProfile.name}</h1>
        <div style="font-size: 11px; color: #4a5568;">
          <a href="mailto:${userProfile.email}" style="color: #2b6cb0; text-decoration: none;">${userProfile.email}</a> | ${userProfile.phone} | 
          <a href="${userProfile.linkedin}" style="color: #2b6cb0; text-decoration: none;">LinkedIn</a> | 
          <a href="${userProfile.github}" style="color: #2b6cb0; text-decoration: none;">GitHub</a>
        </div>
      </div>

      <h2>Summary</h2>
      <div class="section"><p>[AI: Tailored 4-sentence impact summary]</p></div>

      <h2>Technical Skills</h2>
      <div class="section">[AI: Comprehensive JD-matched skill categories]</div>

      <h2>Education</h2>
      <div class="section">
        <div class="split-row"><strong>${userProfile.education.degree}</strong><span style="font-weight:bold;">${userProfile.education.year}</span></div>
        <p>${userProfile.education.institution}, Hyderabad</p>
      </div>

     <h2>Work Experience</h2>
    <div class="section">
      ${userProfile.experience.map(e => `
        <div class="split-row"><strong>${e.title}</strong><span style="font-weight: bold; font-size: 10px;">${e.duration}</span></div>
        <p><em>${e.company}</em></p>
        <ul>${e.responsibilities.slice(0,2).map(r => `<li>${r}</li>`).join("")}</ul>
      `).join("")}
    </div>

      <h2>Projects</h2>
      <div class="section">[AI: 2 projects with 2 detailed, metric-heavy bullets each]</div>

      <h2>Certifications</h2>
      <div class="section">[AI: cert-item for each cert with a technical project desc]</div>

     <h2>Achievements</h2>
      <div class="section"><ul>[AI: Exactly 2 impact-driven achievements with metrics]</ul></div>

      <div style="display:flex; justify-content:space-between; margin-top:19.8px; border-top:1px solid #cbd5e1; padding-top:12px;">
        <div style="font-size:10px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 1]</div>
        <div style="font-size:10px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 2]</div>
        <div style="font-size:10px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 3]</div>
        <div style="font-size:10px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 4]</div>
      </div>
    </body>
    </html>`;

    // 2. AI Generation
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.7,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,
        }
    });

    let html = result.response.text();
    html = html.replace(/```html|```/g, "");
    const startIndex = html.indexOf("<!DOCTYPE html>");
    if (startIndex !== -1) html = html.substring(startIndex);

    // 3. Return Success with Quota
    return res.status(200).json({ 
      success: true, 
      resume: html,
      quota: { remaining, limit, used: limit - remaining, reset: new Date(reset).toISOString() }
    });

  } catch (err) {
    console.error('Backend Error:', err);
    return res.status(500).json({ error: err.message });
  }
}