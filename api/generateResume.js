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
    
    // FIX: Using the correct model identifier
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on ATS-friendly keywords and clean formatting.",
      faang: "Emphasize scale, ownership, and measurable impact.",
      startup: "Emphasize versatility, speed, and ownership."
    };

    const prompt = `CRITICAL INSTRUCTION: Output ONLY valid HTML starting with <!DOCTYPE html>. 
    STRICT RULES:
    1. Keep Work Experience to EXACTLY 3 bullet points per role.
    2. Keep Key Achievements to EXACTLY 3 bullet points total.
    3. Include user certifications AND suggest ONE extra high-value certification relevant to the Job Description.
    4. Provide 6 distinct professional characteristic traits for the footer.
    5. Keep content strictly to ONE PAGE but fill it vertically by moving the name to the very top.

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
    line-height: 1.45; 
    color: #1e293b; 
    max-width: 210mm; 
    margin: 0 auto; 
    padding: 5mm 12mm;
  }
  
  .split-row { 
    display: flex; 
    justify-content: space-between; 
    align-items: baseline; 
    width: 100%; 
  }

  h2 { 
    font-size: 13px; 
    margin: 14px 0 6px; 
    border-bottom: 1.5px solid #2b6cb0; 
    color: #1a365d; 
    text-transform: uppercase; 
    letter-spacing: 1px; 
  }
  .section { margin-bottom: 10px; font-size: 10.5px; }
  ul { margin-left: 18px; margin-top: 2px; }
  li { margin-bottom: 3px; }
  p { margin-bottom: 2px; }

  .cert-item { margin-bottom: 6px; }
  .cert-name { font-weight: bold; color: #1e293b; font-size: 10.5px; }
  .cert-desc { font-size: 9.5px; color: #64748b; font-style: italic; display: block; }
</style>
</head>
<body>

  <div style="width: 100%; text-align: center !important; margin-bottom: 15px;">
    <h1 style="font-size: 30px; font-weight: 800; color: #1a365d; text-transform: uppercase; margin-bottom: 0px;">
      ${userProfile.name}
    </h1>
    <div style="font-size: 11px; color: #4a5568; margin-top: 4px;">
      <a href="mailto:${userProfile.email}" style="color: #2b6cb0; text-decoration: none;">${userProfile.email}</a> | 
      ${userProfile.phone} | 
      <a href="${userProfile.linkedin}" style="color: #2b6cb0; text-decoration: none;">LinkedIn</a> | 
      <a href="${userProfile.github}" style="color: #2b6cb0; text-decoration: none;">GitHub</a>
    </div>
  </div>

  <h2>Professional Summary</h2>
  <div class="section"><p>[AI: Tailored summary]</p></div>

  <h2>Technical Skills</h2>
  <div class="section">[AI: Comprehensive categories]</div>

  <h2>Education</h2>
  <div class="section">
    <div class="split-row">
      <strong>${userProfile.education.degree}</strong>
      <span style="font-weight:bold;">${userProfile.education.year}</span>
    </div>
    <p>${userProfile.education.institution}, Hyderabad</p>
  </div>

  <h2>Work Experience</h2>
  <div class="section">
    ${userProfile.experience.map(e => `
      <div class="split-row">
        <strong>${e.title}</strong>
        <span style="font-weight: bold; font-size: 10px;">${e.duration}</span>
      </div>
      <p><em>${e.company}</em></p>
      <ul>${e.responsibilities.slice(0, 3).map(r => `<li>${r}</li>`).join("")}</ul>
    `).join("")}
  </div>

  <h2>Selected Projects</h2>
  <div class="section">[AI: 2 projects. Max 3 bullets each.]</div>

  <h2>Certifications & Expertise</h2>
  <div class="section">[AI: List user certs + 1 suggested cert.]</div>

  <h2>Key Achievements</h2>
  <div class="section"><ul>[AI: EXACTLY 3 high-impact points.]</ul></div>

  <div style="display:flex; justify-content:space-between; margin-top:20px; border-top:1px solid #cbd5e1; padding-top:10px;">
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 1]</div>
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 2]</div>
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 3]</div>
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 4]</div>
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 5]</div>
    <div style="font-size:8.5px; font-weight:800; color:#2b6cb0; text-transform:uppercase;">[Trait 6]</div>
  </div>

</body>
</html>`;

    const result = await model.generateContent(prompt);
    let html = result.response.text();
    html = html.replace(/```html|```/g, "");
    const startIndex = html.indexOf("<!DOCTYPE html>");
    if (startIndex !== -1) html = html.substring(startIndex);

    return res.status(200).json({ success: true, resume: html });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}