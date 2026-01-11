import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { jobDescription, strategy = "ats", pin } = req.body?.data || req.body;

  if (!pin || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: "Unauthorized: Invalid PIN" });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on ATS-friendly keywords and clean formatting.",
      faang: "Emphasize scale, ownership, and measurable impact.",
      startup: "Emphasize versatility, speed, and ownership."
    };

    const prompt = `CRITICAL INSTRUCTION: Output ONLY valid HTML starting with <!DOCTYPE html>. No markdown.

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
  body { font-family: Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a202c; max-width: 210mm; margin: 0 auto; padding: 12mm; }
  
  /* FORCE CENTER ON HEADER */
  .header-box { text-align: center !important; width: 100%; margin-bottom: 15px; display: block; }
  
  h1 { font-size: 30px; font-weight: 800; color: #1a365d; text-transform: uppercase; margin-bottom: 5px; }
  .contact-line { font-size: 10px; color: #4a5568; }
  .contact-line a { color: #2b6cb0; text-decoration: none; margin: 0 4px; }
  
  h2 { font-size: 13px; margin: 15px 0 6px; border-bottom: 1.5px solid #2b6cb0; color: #1a365d; text-transform: uppercase; letter-spacing: 1px; }
  .section { margin-bottom: 10px; font-size: 10.5px; }
  ul { margin-left: 18px; }

  /* EDUCATION LAYOUT */
  .edu-row { display: flex; justify-content: space-between; align-items: baseline; width: 100%; }
</style>
</head>
<body>

  <div class="header-box">
    <h1>${userProfile.name}</h1>
    <div class="contact-line">
      <a href="mailto:${userProfile.email}">${userProfile.email}</a> | 
      ${userProfile.phone} | 
      <a href="${userProfile.linkedin}">LinkedIn</a> | 
      <a href="${userProfile.github}">GitHub</a>
    </div>
  </div>

  <h2>Professional Summary</h2>
  <div class="section"><p>[AI: Tailored summary]</p></div>

  <h2>Technical Skills</h2>
  <div class="section">[AI: Skills]</div>

  <h2>Education</h2>
  <div class="section">
    <p><strong>${userProfile.education.degree}</strong></p>
    <div class="edu-row">
      <span>${userProfile.education.institution}, Hyderabad</span>
      <span style="font-weight:bold;">${userProfile.education.year}</span>
    </div>
  </div>

  <h2>Work Experience</h2>
  <div class="section">
    ${userProfile.experience.map(e => `
      <p><strong>${e.title}</strong><br/>${e.company} | ${e.duration}</p>
      <ul>${e.responsibilities.map(r => `<li>${r}</li>`).join("")}</ul>
    `).join("")}
  </div>

  <h2>Selected Projects</h2>
  <div class="section">[AI: 2 Projects]</div>

  <h2>Certifications</h2>
  <div class="section">[AI: Certs]</div>

  <div style="display:flex; justify-content:space-between; margin-top:20px; border-top:1px solid #eee; padding-top:10px;">
    <div style="font-size:10px; font-weight:700; color:#2b6cb0;">[Trait 1]</div>
    <div style="font-size:10px; font-weight:700; color:#2b6cb0;">[Trait 2]</div>
    <div style="font-size:10px; font-weight:700; color:#2b6cb0;">[Trait 3]</div>
    <div style="font-size:10px; font-weight:700; color:#2b6cb0;">[Trait 4]</div>
  </div>

</body>
</html>`;

    const result = await model.generateContent(prompt);
    let html = result.response.text();
    html = html.replace(/```html|```/g, "");
    html = html.substring(html.indexOf("<!DOCTYPE html>"));

    return res.status(200).json({ success: true, resume: html });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}