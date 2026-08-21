# 점핑배틀 Windows 컨트롤러 분석·커스터마이징 베이스

업로드된 `프로그램테스트.zip`을 실행하지 않고 정적 분석한 결과다.

## 결론

**커스터마이징 가능성은 높다.** 이 프로그램은 네이티브 단일 바이너리가 아니라 Python 3.11 + PySide6 + PyInstaller 기반이다. 핵심 Python 바이트코드 1,359개가 추출됐고, UI 및 일부 업무 로직은 `.py` 원본 23개로 배포본에 그대로 포함돼 있었다. 게임 시작·정지, 패널/맵/인원/시간, MQTT, UDP, Firebase, RTSP 카메라, FFmpeg 타임랩스, 랭킹, 영수증 출력도 모듈별로 구분돼 있다.

다만 현재 배포본에는 Firebase 서비스 계정 개인키, MQTT 계정, RTSP 카메라 계정을 복원할 수 있는 정보가 함께 들어 있다. 그래서 원본 ZIP/EXE, 추출 바이트코드, 자격증명 파일, 제3자 바이너리·폰트는 공개 저장소에 올리지 않았다.

- [전체 분석 보고서](FULL_ANALYSIS_KO.md)
- [비밀값 없는 설정 예시](config/controller.example.json)
- [설정 검증 코드](controller_config.py)
- [자동 검증](tests/test_controller_config.py)
- [원본 식별용 체크섬](inventory/checksums.sha256)
- [배포물 파일 인벤토리](inventory/file_inventory.csv)

## 검증 실행

```bash
cd windows-controller-analysis
python -m unittest discover -s tests -v
python controller_config.py config/controller.example.json
```

## 가장 먼저 해야 할 일

1. 기존 Firebase 서비스 계정 키 폐기
2. MQTT 계정과 카메라 비밀번호 교체
3. 비밀값을 환경변수·Windows Credential Manager/DPAPI로 이동
4. UDP/MQTT 장치 시뮬레이터를 만든 뒤 핵심 로직을 어댑터 구조로 재구축

원본 파일의 GitHub 업로드는 보안과 라이선스 문제 때문에 의도적으로 제외했다.
