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

  const jobDescription = req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

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
- CHARACTER TRAITS: Select EXACTLY 4 professional character traits (e.g., "Problem Solver", "Quick Learner") that specifically match this job description.

OUTPUT RULES:
1. Your FIRST line must be: <!DOCTYPE html>
2. ONLY output the HTML resume.

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 210mm; margin: 0 auto; padding: 10mm; }
h1 { font-size: 36px; font-weight: 700; margin-bottom: 8px; text-align: center; color: #2c3e50; }
.contact { text-align: center; font-size: 11px; margin-bottom: 15px; }
.contact a { color: #3498db; text-decoration: none; margin: 0 8px; }
h2 { font-size: 16px; color: #2c3e50; border-bottom: 2px solid #3498db; margin: 15px 0 8px 0; padding-bottom: 3px; }
.section { margin-bottom: 12px; }
.section p, .section li { font-size: 11px; margin: 3px 0; }
ul { margin-left: 20px; }
li { margin: 2px 0; }
.skills { display: flex; flex-wrap: wrap; gap: 8px; }
.skill { background: #ecf0f1; padding: 4px 10px; border-radius: 3px; font-size: 10px; }
/* Horizontal Traits Style */
.traits-container { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
.trait { font-size: 12px; font-weight: bold; color: #3498db; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
<h1>${userProfile.name}</h1>
<div class="contact">
<a href="mailto:${userProfile.email}">${userProfile.email}</a> | ${userProfile.phone} | 
<a href="${userProfile.linkedin}">LinkedIn</a> | 
<a href="${userProfile.github}">GitHub</a>
</div>

<h2>Professional Summary</h2>
<div class="section"><p>[Tailored summary]</p></div>

<h2>Technical Skills</h2>
<div class="section skills">[Skill badges]</div>

<h2>Education</h2>
<div class="section"><p><strong>${userProfile.education.degree}</strong><br>${userProfile.education.institution}<br>Graduation: ${userProfile.education.year}</p></div>

<h2>Work Experience</h2>
<div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong><br>${exp.company} | ${exp.duration}<ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul></p>`).join('')}</div>

<h2>Projects</h2>
<div class="section">[AI: 2 tailored projects]</div>

<h2>Certifications</h2>
<div class="section"><ul>[AI: 2-3 JD-relevant certifications]</ul></div>

<h2>Achievements</h2>
<div class="section"><ul>[AI: List achievements with learning lines]</ul></div>

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