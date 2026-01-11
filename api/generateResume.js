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
    
    // NOTE: Official API ID is "gemini-1.5-flash" to access the Flash engine.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Load Sunny's Profile
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on machine-readable keywords and clean formatting.",
      faang: "Focus on scale, impact, and high-level quantitative metrics.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    const prompt = `CRITICAL INSTRUCTION: You are a professional resume writer. Use the applicant details to create a tailored resume.

===== APPLICANT DETAILS =====
Name: ${userProfile.name}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin}
GitHub: ${userProfile.github}
Education: ${userProfile.education.degree} from ${userProfile.education.institution} (${userProfile.education.year})
Work Experience: ${userProfile.experience.map(exp => `${exp.title} at ${exp.company}`).join(', ')}
All Achievements/Certs: ${userProfile.achievements?.join(', ') || ''}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

DYNAMIC CONTENT RULES:
- PROJECTS: Select 2 projects from the profile. CHANGE the descriptions to be relevant to the Job Description provided.
- CERTIFICATIONS: List MAX 2-3 certifications only. They must be related to freshers and relevant to the Job Description.
- ACHIEVEMENTS: Include 3-4 achievements. For those related to certifications, add a 1-2 line description about what was learned through the specific project/certification.

OUTPUT RULES:
1. FIRST line must be: <!DOCTYPE html>
2. ONLY output the HTML resume.
3. Use a clean, professional CSS style within <style> tags.

Use this structure:
<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 210mm; margin: 0 auto; padding: 10mm; }
h1 { font-size: 32px; text-align: center; color: #2c3e50; }
.contact { text-align: center; font-size: 11px; margin-bottom: 15px; }
h2 { font-size: 16px; color: #2c3e50; border-bottom: 2px solid #3498db; margin: 15px 0 8px 0; }
.section { margin-bottom: 12px; font-size: 11px; }
ul { margin-left: 20px; }
</style>
</head>
<body>
<h1>${userProfile.name}</h1>
<div class="contact">${userProfile.email} | ${userProfile.phone} | LinkedIn | GitHub</div>
<h2>Professional Summary</h2>
<div class="section">[Summary based on strategy]</div>
<h2>Work Experience</h2>
<div class="section">[Relevant experience detail]</div>
<h2>Projects</h2>
<div class="section">[2 projects tailored to JD]</div>
<h2>Certifications</h2>
<div class="section"><ul>[2-3 relevant certs]</ul></div>
<h2>Achievements</h2>
<div class="section"><ul>[3-4 achievements with learning descriptions]</ul></div>
<h2>Education</h2>
<div class="section">${userProfile.education.degree} - ${userProfile.education.institution}</div>
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