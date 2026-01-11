import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  // ─────────────────────────────────────────────
  // INPUT
  // ─────────────────────────────────────────────
  const { jobDescription, strategy = "ats", pin } =
    req.body?.data || req.body;

  if (!pin || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: "Unauthorized: Invalid PIN" });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription" });
  }

  try {
    // ─────────────────────────────────────────────
    // GEMINI
    // ─────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview"
    });

    // ─────────────────────────────────────────────
    // LOAD PROFILE
    // ─────────────────────────────────────────────
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(
      fs.readFileSync(profilePath, "utf8")
    );

    const strategyMap = {
      ats: "Focus on ATS-friendly keywords and clean formatting.",
      faang: "Emphasize scale, ownership, and measurable impact.",
      startup: "Emphasize versatility, speed, and ownership."
    };

    // ─────────────────────────────────────────────
    // PROMPT
    // ─────────────────────────────────────────────
    const prompt = `CRITICAL INSTRUCTION:
You are a professional resume writer.

OUTPUT RULES:
- Output ONLY valid HTML
- FIRST LINE must be <!DOCTYPE html>
- NO markdown
- NO explanations

===== PROFILE =====
${JSON.stringify(userProfile)}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY:
${strategyMap[strategy]}

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: Helvetica, Arial, sans-serif;
  line-height: 1.5;
  color: #1a202c;
  max-width: 210mm;
  margin: 0 auto;
  padding: 12mm;
}

/* CENTERED HEADER — PDF SAFE */
.header {
  text-align: center;
  width: 100%;
  margin-bottom: 14px;
}

.header h1 {
  font-size: 32px;
  font-weight: 800;
  color: #1a365d;
  text-transform: uppercase;
  width: 100%;
}

.header .contact {
  font-size: 10px;
  color: #4a5568;
  margin-top: 4px;
}

.header a {
  color: #2b6cb0;
  text-decoration: none;
  margin: 0 6px;
}

h2 {
  font-size: 14px;
  margin: 16px 0 6px;
  border-bottom: 1.5px solid #2b6cb0;
  color: #1a365d;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section p, .section li {
  font-size: 10.5px;
}

ul { margin-left: 18px; }

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill {
  background: #edf2f7;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 600;
}

.traits {
  display: flex;
  justify-content: space-between;
  margin-top: 22px;
  border-top: 1px solid #e2e8f0;
  padding-top: 10px;
}

.trait {
  font-size: 11px;
  font-weight: 700;
  color: #2b6cb0;
  text-transform: uppercase;
  letter-spacing: 1.4px;
}
</style>
</head>

<body>

<div class="header">
  <h1>${userProfile.name}</h1>
  <div class="contact">
    <a href="mailto:${userProfile.email}">${userProfile.email}</a> |
    ${userProfile.phone} |
    <a href="${userProfile.linkedin}">LinkedIn</a> |
    <a href="${userProfile.github}">GitHub</a>
  </div>
</div>

<h2>Professional Summary</h2>
<div class="section">
  <p>[AI: Tailored summary aligned to JD]</p>
</div>

<h2>Technical Skills</h2>
<div class="section skills">
  [AI: Skill badges]
</div>

<h2>Education</h2>
<div class="section">
  <p><strong>${userProfile.education.degree}</strong></p>
  <p>${userProfile.education.institution} — ${userProfile.education.year}</p>
</div>

<h2>Work Experience</h2>
<div class="section">
  ${userProfile.experience
    .map(
      e => `
    <p><strong>${e.title}</strong><br/>
    ${e.company} | ${e.duration}</p>
    <ul>${e.responsibilities.map(r => `<li>${r}</li>`).join("")}</ul>
  `
    )
    .join("")}
</div>

<h2>Selected Projects</h2>
<div class="section">
  [AI: 2 JD-matched projects with metrics]
</div>

<h2>Certifications</h2>
<ul>
  [AI: 2–3 certifications]
</ul>

<h2>Key Achievements</h2>
<ul>
  [AI: 3–4 achievements]
</ul>

<div class="traits">
  <div class="trait">[Trait 1]</div>
  <div class="trait">[Trait 2]</div>
  <div class="trait">[Trait 3]</div>
  <div class="trait">[Trait 4]</div>
</div>

</body>
</html>`;

    // ─────────────────────────────────────────────
    // GENERATE
    // ─────────────────────────────────────────────
    const result = await model.generateContent(prompt);
    let html = result.response.text();

    html = html.replace(/```html|```/g, "");
    html = html.substring(html.indexOf("<!DOCTYPE html>"));

    return res.status(200).json({
      success: true,
      resume: html
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
