/*
  QUAD//LAB - Arduino Mega 2560 + PCA9685 / 12 channels
  GENERATED OPEN-LOOP GAIT EXAMPLE; NOT HARDWARE-VERIFIED.
  Required library: Adafruit PWM Servo Driver Library.
  Mega: SDA D20 -> PCA SDA, SCL D21 -> PCA SCL,
        5V -> PCA VCC, GND -> PCA GND.
  Each servo must use its OWN correctly regulated power rail.
  In the reference wiring, PCA V+ is UNUSED; servo signals only
  are routed from PCA channels, servo power comes from separate BECs.
  Every servo ground and PCA ground must share a SIGNAL REFERENCE.
  USB powers Mega during benchtop tests; standalone controller
  power supply is NOT included in this generated schematic.
  NEVER connect a 2S LiPo directly to a servo above its rating.
  Confirm servo pulse width, mechanical center, direction and limits
  using ONE UNLOADED MOTOR before using this with 12 servos.
*/
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <math.h>

Adafruit_PWMServoDriver pwm(0x40);
const float UPPER_MM = 145.00f;
const float LOWER_MM = 165.00f;
const float BODY_H_MM = 275.00f;
const float BODY_L_MM = 430.00f;
const float BODY_W_MM = 270.00f;
const float STRIDE_MM = 75.00f;
const float LIFT_MM = 48.00f;
const float PERIOD_S = 2.80f;
const float DUTY = 0.75f;
const int SERVO_CENTER = 135;
const int SAFE_MIN_DEG = 95;
const int SAFE_MAX_DEG = 175;
// EXAMPLE pulse endpoints for 0-270 degrees - verify against hardware.
const int PULSE_MIN_US = 1000;
const int PULSE_MAX_US = 2000;
const float PHASE[4] = {0.0f, 0.50f, 0.75f, 0.25f};
// Adjust +1/-1 to each actual servo's mounting direction.
int servoSign[12] = {1,1,1,1,1,1,1,1,1,1,1,1};
float servoTrim[12] = {0};
float clipf(float x,float lo,float hi){return fmaxf(lo,fminf(hi,x));}

void outputServo(int channel,float degrees){
  degrees = clipf(SERVO_CENTER + servoSign[channel]*(degrees-SERVO_CENTER)
                  +servoTrim[channel],SAFE_MIN_DEG,SAFE_MAX_DEG);
  // This linear mapping must match the physical 270-degree servo.
  float micros = PULSE_MIN_US + (degrees/270.0f)*(PULSE_MAX_US-PULSE_MIN_US);
  // 50 Hz (20,000 us period), 4096 PCA counts.
  int ticks=(int)roundf(clipf(micros/20000.0f*4096.0f,0,4095));
  pwm.setPWM(channel,0,ticks);
}

void solveLeg(int id,float t){
  int front=(id<2)?1:-1,side=(id%2==0)?1:-1;
  float hipX=front*(BODY_L_MM*0.5f-8),hipZ=side*(BODY_W_MM*0.5f+5);
  float q=fmodf(t/PERIOD_S+PHASE[id],1.0f);
  if(q<0)q+=1.0f;
  float progress=0.0f,stepHeight=0.0f;
  if(q<DUTY){progress=0.5f-q/DUTY;}
  else {float u=(q-DUTY)/(1.0f-DUTY);
        progress=-0.5f+u*u*(3-2*u);
        stepHeight=LIFT_MM*sinf(3.14159265f*u);}
  float dx=front*29+STRIDE_MM*progress;
  float dz=side*88.0f;
  float dy=stepHeight-BODY_H_MM;
  float v=hypotf(dy,dz),d=hypotf(dx,v);
  float lo=fabsf(UPPER_MM-LOWER_MM)+0.01f,hi=UPPER_MM+LOWER_MM-0.01f;
  d=clipf(d,lo,hi);
  float k=(UPPER_MM*UPPER_MM+d*d-LOWER_MM*LOWER_MM)/(2*d);
  float h=sqrtf(fmaxf(0,UPPER_MM*UPPER_MM-k*k));
  float kneeX=k*dx/(d+0.000001f) +front*h*v/(d+0.000001f);
  float kneeDown=k*v/(d+0.000001f) -front*h*dx/(d+0.000001f);
  float roll=atan2f(dz,fmaxf(1,-dy))*180.0f/3.14159265f;
  float pitch=atan2f(kneeX,kneeDown)*180.0f/3.14159265f;
  float bend=180.0f-acosf(clipf((UPPER_MM*UPPER_MM+
            LOWER_MM*LOWER_MM-d*d)/(2*UPPER_MM*LOWER_MM),-1,1))
            *180.0f/3.14159265f;
  // These are mathematical joint values mapped to a nominal center.
  // Calibrate mechanically before letting the robot bear its weight.
  outputServo(id*3+0,SERVO_CENTER+roll);
  outputServo(id*3+1,SERVO_CENTER+pitch);
  outputServo(id*3+2,SERVO_CENTER+bend);
}

bool running=false;
unsigned long lastTick=0,stopAt=0;
float elapsed=0.0f;
String serialLine="";
void command(String line){
 line.trim();line.toUpperCase();
 if(line=="S"){running=false;Serial.println("STOP");return;}
 if(line.startsWith("R ")){
   float seconds=line.substring(2).toFloat();
   if(seconds>0&&seconds<=3600){
     running=true;elapsed=0;lastTick=millis();
     stopAt=lastTick+(unsigned long)(seconds*1000.0f);
     Serial.print("RUN ");Serial.print(seconds);Serial.println(" s");
   }else Serial.println("ERR: use R <seconds>, 0..3600");
   return;
 }
 Serial.println("Commands: R 10 (run 10 s), S (stop)");
}
void setup(){
 Serial.begin(115200);Wire.begin();pwm.begin();pwm.setPWMFreq(50);
 delay(20);lastTick=millis();
 // HOLD nominal neutral; inspect calibration before powering 12 servos.
 for(int i=0;i<12;i++)outputServo(i,SERVO_CENTER);
 Serial.println("QUAD LAB READY | R 10 | S");
}
void loop(){
 while(Serial.available()){
   char ch=(char)Serial.read();
   if(ch=='\n'||ch=='\r'){if(serialLine.length())command(serialLine);serialLine="";}
   else if(serialLine.length()<40)serialLine+=ch;
 }
 if(!running)return;
 unsigned long now=millis();
 if((long)(now-stopAt)>=0){running=false;Serial.println("COMPLETE");return;}
 if((unsigned long)(now-lastTick)>=20){
   elapsed+=(now-lastTick)*0.001f;lastTick=now;
   for(int leg=0;leg<4;leg++)solveLeg(leg,elapsed);
 }
}
