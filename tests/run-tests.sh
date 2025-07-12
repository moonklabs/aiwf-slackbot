#!/bin/bash

# 테스트 실행 스크립트
# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 MCP 서버 테스트 시작${NC}"
echo "=================================="

# 환경 변수 설정
export NODE_ENV=test
export LOG_LEVEL=info

# 1. TypeScript 컴파일 체크
echo -e "\n${YELLOW}1. TypeScript 컴파일 체크${NC}"
npm run typecheck
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ TypeScript 컴파일 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ TypeScript 컴파일 성공${NC}"

# 2. ESLint 체크
echo -e "\n${YELLOW}2. ESLint 체크${NC}"
npm run lint
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ESLint 체크 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ ESLint 체크 성공${NC}"

# 3. 단위 테스트 실행
echo -e "\n${YELLOW}3. 단위 테스트 실행${NC}"
npm test -- tests/mcp-server.test.ts
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 단위 테스트 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 단위 테스트 성공${NC}"

# 4. 통합 테스트 실행
echo -e "\n${YELLOW}4. 통합 테스트 실행${NC}"
npx ts-node tests/integration-test.ts
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 통합 테스트 실패${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 통합 테스트 성공${NC}"

# 5. 실제 서버 시작 테스트 (5초간)
echo -e "\n${YELLOW}5. 실제 서버 시작 테스트${NC}"
echo "서버를 5초간 실행합니다..."

# 백그라운드에서 서버 시작
npm run dev &
SERVER_PID=$!

# 5초 대기
sleep 5

# 서버가 실행 중인지 확인
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✅ 서버가 정상적으로 실행 중입니다${NC}"
    # 서버 종료
    kill $SERVER_PID
    wait $SERVER_PID 2>/dev/null
else
    echo -e "${RED}❌ 서버가 실행되지 않았습니다${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 모든 테스트가 성공적으로 완료되었습니다!${NC}"
echo "=================================="

# 테스트 workspace 정리
rm -rf test-workspace 2>/dev/null

exit 0