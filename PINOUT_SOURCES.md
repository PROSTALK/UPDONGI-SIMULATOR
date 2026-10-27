# 배선 작업대의 핀 자료

확인일: 2026-10-27.

- Arduino Mega 2560 Rev3 공식 전체 핀 배치: https://docs.arduino.cc/resources/pinouts/A000067-full-pinout.pdf
- Arduino Mega 2560 Rev3 공식 하드웨어 문서: https://docs.arduino.cc/hardware/mega-2560/
- Adafruit PCA9685 핀 설명: https://learn.adafruit.com/16-channel-pwm-servo-driver/pinouts

Mega의 주 디지털·아날로그 헤더와 전원 핀, D20/SDA·D21/SCL 중복 헤더 및 GND·5V 공통 연결을 참고하였다. PCA9685의 양쪽 제어 헤더, 16개 채널의 PWM/V+/GND와 공통 전원 레일, VCC와 V+의 구분을 반영하였다.

UI의 보드 그림은 이 앱에서 새로 작성한 설명용 벡터 도형이다. 공식 사진·로고·CAD 이미지를 포함하지 않으며, 원본 핀 배치 PDF의 그림도 재배포하지 않는다. 소켓 위치의 상대적인 배열을 참고하되, 간격과 칩·잭 등의 외형을 가독성에 맞게 단순화했다. Mega의 ICSP/ICSP1 프로그래밍 헤더, USB 내부 회로와 테스트 포인트는 이 연습 화면의 연결 대상으로 제공하지 않는다. 특히 PCA9685 호환 보드, BEC와 서보 커넥터의 정확한 외형·순서는 구매한 제품 자료를 확인해야 한다.

원본 Arduino 핀 배치 PDF의 라이선스 표기는 CC BY-SA 4.0이며, 자료의 저작자는 Arduino이다. 이 앱은 공식 제품 또는 Arduino·Adafruit가 제공한 시뮬레이터라고 주장하지 않는다.
