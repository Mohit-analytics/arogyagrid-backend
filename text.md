quick sanity check :   cd path\to\arogyagrid-backendnode server.js 
                             GEMINI_API_KEY loaded: true

second terminal frontend :    cd path\to\arogyagrid-frontend
   npm run dev

Set up and confirm the full chain works :
          git checkout -b hackathon-build

Before eating : git add .
git commit -m "Core ArogyaGrid: dashboard + Gemini + risk + redistribution working"
git push origin hackathon-build

Testing and freeze :    git add .
   git commit -m "Feature freeze before judging"
   git push origin hackathon-build
   