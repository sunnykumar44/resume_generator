import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const jobDescription = req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) return res.status(400).json({ error: "Missing jobDescription" });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // This ID is the "Universal Alias" that works across all Vercel regions
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    const strategyMap = {
      ats: "Focus on machine-readable keywords and clean formatting.",
      faang: "Focus on scale, impact, and high-level quantitative metrics.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    const prompt = `CRITICAL INSTRUCTION: You are a professional resume writer for a FRESHER. Create a resume demonstrating UPTO INTERMEDIATE-LEVEL skills using the provided profile data.

===== APPLICANT DATA =====
Profile: ${JSON.stringify(userProfile)}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

DYNAMIC CONTENT RULES:
1. PROJECTS: Select 2 projects from the profile. Rewrite descriptions to be relevant to the Job Description.
2. CERTIFICATIONS: List max 2-3 certifications only. They should be related to freshers and relevant to the JD.
3. ACHIEVEMENTS: Include 3-4 achievements. For certifications, add 1-2 lines on the project or skill learned to earn it.

OUTPUT RULES:
- ONLY output HTML starting exactly with <!DOCTYPE html>.
- DO NOT use markdown code blocks or backticks.
- Use a professional single-column CSS layout.

Use this structure:
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 28px; text-align: center; color: #2c3e50; }
  .contact { text-align: center; font-size: 11px; margin-bottom: 15px; }
  h2 { font-size: 16px; color: #2c3e50; border-bottom: 2px solid #3498db; margin: 15px 0 10px 0; }
  .section { margin-bottom: 12px; font-size: 11px; }
  ul { margin-left: 20px; }
</style>
</head>
<body>
  <h1>${userProfile.name}</h1>
  <div class="contact">${userProfile.email} | ${userProfile.phone} | LinkedIn</div>
  <h2>Professional Summary</h2>
  <div class="section">[AI: Tailored Summary]</div>
  <h2>Work Experience</h2>
  <div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong> - ${exp.company} (${exp.duration})</p>`).join('')}</div>
  <h2>Projects</h2>
  <div class="section">[AI: 2 Projects tailored to JD]</div>
  <h2>Certifications</h2>
  <div class="section"><ul>[AI: 2-3 relevant certs]</ul></div>
  <h2>Achievements</h2>
  <div class="section"><ul>[AI: 3-4 achievements with learning lines]</ul></div>
  <h2>Education</h2>
  <div class="section">${userProfile.education.degree} - ${userProfile.education.institution} (${userProfile.education.year})</div>
</body>
</html>`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/```html|```/g, '');
    const htmlStart = responseText.indexOf('<!DOCTYPE html>');
    if (htmlStart > -1) responseText = responseText.substring(htmlStart);

    return res.status(200).json({ success: true, resume: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}