import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // 1. Vercel CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // UPDATED: Extract pin along with other data
  const { jobDescription, strategy = "ats", pin } = req.body?.data || req.body;

  // SECURITY CHECK: Match the incoming PIN with your secret Vercel variable
  if (!pin || pin !== process.env.APP_PIN) {
    return res.status(401).json({ error: "Unauthorized: Invalid PIN." });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    // 3. Load Sunny's Profile
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on machine-readable keywords and clean formatting.",
      faang: "Focus on scale, impact, and high-level quantitative metrics.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    const prompt = `CRITICAL INSTRUCTION: You are a professional resume writer. Create a high-impact resume for a FRESHER.

===== APPLICANT DATA =====
Profile: ${JSON.stringify(userProfile)}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

DYNAMIC CONTENT RULES:
- PROJECTS: Select 2 relevant projects. Rewrite descriptions to match JD keywords.
- CERTIFICATIONS: List MAX 2-3 relevant to freshers and the JD.
- ACHIEVEMENTS: 3-4 items. For certs, add 1-2 lines on the project/skill learned.
- QUANTITATIVE IMPACT: Rewrite bullet points to include realistic estimated metrics (e.g., "Increased efficiency by 15%", "Reduced load time by 200ms", "Handled 500+ data points").
- CHARACTER TRAITS: Select EXACTLY 4 professional character traits related to the JD.

OUTPUT RULES:
1. Your FIRST line must be: <!DOCTYPE html>
2. ONLY output the HTML resume. No markdown.

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Helvetica', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 210mm; margin: 0 auto; padding: 10mm; }

/* FIX: Ensure name and contact take full width and are centered */
h1 { font-size: 32px; font-weight: 700; margin-bottom: 5px; text-align: center; color: #1a365d; text-transform: uppercase; width: 100%; }
.contact { text-align: center; font-size: 10px; margin-bottom: 15px; color: #666; width: 100%; }

.contact a { color: #2b6cb0; text-decoration: none; margin: 0 5px; }
h2 { font-size: 14px; color: #1a365d; border-bottom: 1.5px solid #2b6cb0; margin: 15px 0 8px 0; text-transform: uppercase; letter-spacing: 1px; }
.section { margin-bottom: 10px; }
.section p, .section li { font-size: 10.5px; margin: 2px 0; }
ul { margin-left: 18px; }
.skills { display: flex; flex-wrap: wrap; gap: 6px; }
.skill { background: #edf2f7; padding: 3px 8px; border-radius: 4px; font-size: 9.5px; color: #2d3748; font-weight: 600; }
.traits-container { display: flex; justify-content: space-around; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.trait { font-size: 11px; font-weight: 700; color: #2b6cb0; text-transform: uppercase; letter-spacing: 1.5px; }
</style>
</head>
<body>

/* Ensure this is inside your api/generateResume.js file */

<h1 style="text-align: center; width: 100%; font-size: 32px; font-weight: 700; color: #1a365d; text-transform: uppercase;">
  ${userProfile.name}
</h1>

<div style="text-align: center; width: 100%; font-size: 10px; margin-bottom: 15px;">
  <a href="mailto:${userProfile.email}">${userProfile.email}</a> | ${userProfile.phone} | 
  <a href="${userProfile.linkedin}">LinkedIn</a> | 
  <a href="${userProfile.github}">GitHub</a>
</div>

<h2>Professional Summary</h2>
<div class="section"><p>[AI: Tailored summary with a focus on ${strategy}]</p></div>

<h2>Technical Skills</h2>
<div class="section skills">[AI: JD-relevant badges]</div>

<h2>Education</h2>
<div class="section">
  <p><strong>${userProfile.education.degree}</strong></p>
  
  <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 11px;">
    <span>${userProfile.education.institution}, Hyderabad</span>
    <span style="font-weight: bold;">${userProfile.education.year}</span>
  </div>
</div>

<h2>Work Experience</h2>
<div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong><br>${exp.company} | ${exp.duration}<ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul></p>`).join('')}</div>

<h2>Selected Projects</h2>
<div class="section">[AI: 2 tailored projects with impact metrics]</div>

<h2>Certifications</h2>
<div class="section"><ul>[AI: 2-3 JD-relevant certs]</ul></div>

<h2>Key Achievements</h2>
<div class="section"><ul>[AI: Impactful achievements]</ul></div>

<div class="traits-container">
  <div class="trait">[Trait 1]</div>
  <div class="trait">[Trait 2]</div>
  <div class="trait">[Trait 3]</div>
  <div class="trait">[Trait 4]</div>
</div>
</body>
</html>`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/```html|```/g, '');
    const htmlStart = responseText.indexOf('<!DOCTYPE html>');
    if (htmlStart > -1) {
      responseText = responseText.substring(htmlStart);
    }

    return res.status(200).json({ success: true, resume: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}