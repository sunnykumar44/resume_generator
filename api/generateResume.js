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

  // 2. Extract Data (Handling both direct and Firebase-style wrappers)
  const jobDescription = req.body?.jobDescription || req.body?.data?.jobDescription;
  const strategy = req.body?.strategy || "ats";

  if (!jobDescription) {
    return res.status(400).json({ error: "Missing jobDescription parameter." });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Note: 'gemini-1.5-flash' is used because 'gemini-3-flash' is not a valid/existing model name as of Jan 2026
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Load Sunny's Profile
    const profilePath = path.join(process.cwd(), "profile.json");
    const userProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    // 4. Strategy Map (Optional prompt tuning)
    const strategyMap = {
      ats: "Focus on machine-readable keywords and clean formatting.",
      faang: "Focus on scale, impact, and high-level quantitative metrics.",
      startup: "Focus on versatility, building from 0 to 1, and speed."
    };

    // 5. Your Original Prompt Logic → only added tailoring instructions
    const prompt = `CRITICAL INSTRUCTION: You are creating a resume for a job applicant. The job description below is ONLY for reference - DO NOT COPY IT. Create ONLY the applicant's resume.

===== APPLICANT DETAILS =====
Name: ${userProfile.name}
Email: ${userProfile.email}
Phone: ${userProfile.phone}
LinkedIn: ${userProfile.linkedin}
GitHub: ${userProfile.github}
Degree: ${userProfile.education.degree}
University: ${userProfile.education.institution}
Graduation Year: ${userProfile.education.year}
Work Experience: ${userProfile.experience.map(exp => `${exp.title} at ${exp.company} (${exp.duration}): ${exp.responsibilities.join('; ')}`).join(' | ')}

===== JOB DESCRIPTION =====
${jobDescription}

STRATEGY: ${strategyMap[strategy] || strategyMap.ats}

===== IMPORTANT TAILORING INSTRUCTIONS =====
- Projects: Select/create 2-3 realistic fresher projects and tailor their description, technologies and impact to match the job description
- Certifications: Select only 2-3 most relevant fresher-level certifications that would help for this job description
- Achievements: Write 3-4 achievements connected to learning, projects or certifications, make them somewhat relevant to the job when possible

OUTPUT RULES:
1. Your FIRST line must be: <!DOCTYPE html>
2. ONLY output the HTML resume.
3. The name "${userProfile.name}" must be the first visible text.

Use this exact structure:

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
<div class="section"><p>[Write 2-3 sentences based on the ${strategy} strategy]</p></div>

<h2>Technical Skills</h2>
<div class="section skills">[Add skill badges relevant to job]</div>

<h2>Education</h2>
<div class="section"><p><strong>${userProfile.education.degree}</strong><br>${userProfile.education.institution}<br>Graduation: ${userProfile.education.year}</p></div>

<h2>Work Experience</h2>
<div class="section">${userProfile.experience.map(exp => `<p><strong>${exp.title}</strong><br>${exp.company} | ${exp.duration}<ul>${exp.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul></p>`).join('')}</div>

<h2>Projects</h2>
<div class="section">[Add 2-3 realistic projects - tailored to JD]</div>

<h2>Certifications</h2>
<div class="section"><ul>[Add 2-3 relevant fresher certifications - matched to JD]</ul></div>

<h2>Achievements</h2>
<div class="section"><ul>[Add 3-4 achievements - connect to learning/certifications/projects, some relevance to JD]</ul></div>

</body>
</html>`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // 6. Clean Markdown and Extract HTML
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