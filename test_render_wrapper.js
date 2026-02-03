const { execSync } = require('child_process');
const path = require('path');

// 프로젝트 루트로 이동 (중요)
const projectRoot = 'c:/projects/momcast';
process.chdir(projectRoot);

// 환경 변수 설정
process.env.PROJECT_DATA = JSON.stringify({
    templateUrl: 'http://localhost:3000/templates/meafteryou.json',
    scenes: [{ id: 'comp_87', width: 1920, height: 1080 }] // Scene 20
});

console.log('🚀 Running render-server.js from:', process.cwd());

try {
    // 상대 경로 사용 (루트로 이동했으므로)
    execSync('node scripts/render/render-server.js', { stdio: 'inherit', env: process.env });
} catch (e) {
    console.error('❌ Execution failed:', e);
}
