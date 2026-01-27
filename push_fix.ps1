# 1. Cancel the failed commit
git reset --soft HEAD~1

# 2. Remove large video files from Git index (keep them locally)
Write-Host "Removing large video files from git index..." -ForegroundColor Cyan
git rm -r --cached public/images/*.mp4 2>$null
git rm -r --cached public/images/*.mov 2>$null

# 3. Add updated .gitignore and other changes
git add .gitignore
git add .

# 4. Re-commit
git commit -m "feat: 비디오 엔진 통합 및 대용량 파일 제외 완료"

# 5. Push to GitHub
Write-Host "Pushing to GitHub (momcast.co.kr)..." -ForegroundColor Green
git push origin main

Write-Host "Done! Please check your GitHub repository." -ForegroundColor Green
