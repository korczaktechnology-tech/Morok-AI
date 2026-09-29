#!/usr/bin/env bash
set -euo pipefail
APP=apps/client/android
JAVA=apps/client/android/app/src/main/java/com/korczak/morok
RES=apps/client/android/app/src/main/res
mkdir -p "$JAVA" "$RES/xml"
cat > "$JAVA/MainActivity.java" <<'EOF'
package com.korczak.morok;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle b){ registerPlugin(MorokWakePlugin.class); registerPlugin(MorokUpdaterPlugin.class); super.onCreate(b); }
}
EOF
cat > "$JAVA/MorokWakePlugin.java" <<'EOF'
package com.korczak.morok;
import android.Manifest; import android.content.*; import android.content.pm.PackageManager; import android.net.Uri; import android.provider.Settings;
import androidx.core.app.ActivityCompat; import com.getcapacitor.*; import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="MorokWake")
public class MorokWakePlugin extends Plugin {
 @PluginMethod public void startWakeMode(PluginCall c){
  if(ActivityCompat.checkSelfPermission(getContext(),Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) ActivityCompat.requestPermissions(getActivity(),new String[]{Manifest.permission.RECORD_AUDIO},721);
  if(!Settings.canDrawOverlays(getContext())){Intent i=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getContext().getPackageName()));i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);getContext().startActivity(i);}
  if(ActivityCompat.checkSelfPermission(getContext(),Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED&&Settings.canDrawOverlays(getContext())){Intent s=new Intent(getContext(),MorokWakeService.class);if(android.os.Build.VERSION.SDK_INT>=26)getContext().startForegroundService(s);else getContext().startService(s);}
  c.resolve();
 }
 @PluginMethod public void stopWakeMode(PluginCall c){getContext().stopService(new Intent(getContext(),MorokWakeService.class));c.resolve();}
}
EOF
cat > "$JAVA/MorokWakeService.java" <<'EOF'
package com.korczak.morok;
import android.app.*;import android.content.*;import android.graphics.*;import android.graphics.PixelFormat;import android.graphics.drawable.GradientDrawable;import android.os.*;import android.speech.*;import android.view.*;import android.widget.*;import androidx.core.app.NotificationCompat;import java.util.*;
public class MorokWakeService extends Service{
 static final String CH="morok_wake"; SpeechRecognizer r; WindowManager wm; View overlay; Handler h=new Handler(Looper.getMainLooper()); boolean listening;
 public void onCreate(){super.onCreate();NotificationManager n=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(Build.VERSION.SDK_INT>=26)n.createNotificationChannel(new NotificationChannel(CH,"Morok — ativação por voz",NotificationManager.IMPORTANCE_LOW));startForeground(812,new NotificationCompat.Builder(this,CH).setContentTitle("Morok").setContentText("Escutando a palavra de ativação").setSmallIcon(android.R.drawable.ic_btn_speak_now).setOngoing(true).build());wm=(WindowManager)getSystemService(WINDOW_SERVICE);h.postDelayed(this::listen,500);}
 void listen(){if(listening)return;try{if(!SpeechRecognizer.isRecognitionAvailable(this)){retry(2000);return;}r=SpeechRecognizer.createSpeechRecognizer(this);r.setRecognitionListener(new RecognitionListener(){public void onReadyForSpeech(Bundle b){listening=true;}public void onBeginningOfSpeech(){}public void onRmsChanged(float v){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){restart();}public void onError(int e){restart();}public void onResults(Bundle b){check(b);restart();}public void onPartialResults(Bundle b){check(b);}public void onEvent(int e,Bundle b){}});Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR");i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);r.startListening(i);}catch(Exception e){retry(1500);}}
 void check(Bundle b){ArrayList<String>x=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(x!=null)for(String s:x)if(wake(s)){show();return;}}
 boolean wake(String s){s=java.text.Normalizer.normalize(s.toLowerCase(Locale.ROOT),java.text.Normalizer.Form.NFD).replaceAll("\\p{M}","");return s.matches(".*\\bmorok\\b.*\\bacorda(r)?\\b.*")||s.matches(".*\\bacorda(r)?\\b.*\\bmorok\\b.*");}
 void restart(){listening=false;try{if(r!=null)r.destroy();}catch(Exception e){}r=null;retry(250);}void retry(long m){listening=false;h.postDelayed(this::listen,m);}
 GradientDrawable bg(int f,int s,int rad){GradientDrawable d=new GradientDrawable();d.setColor(f);d.setStroke(2,s);d.setCornerRadius(rad);return d;}
 void show(){h.post(()->{if(overlay!=null)return;LinearLayout b=new LinearLayout(this);b.setOrientation(LinearLayout.VERTICAL);b.setGravity(Gravity.CENTER);b.setPadding(28,20,28,20);b.setBackground(bg(0xF20B0B16,0xAA7C5CFF,28));TextView t=new TextView(this);t.setText("MOROK");t.setTextColor(Color.WHITE);t.setTextSize(24);t.setGravity(Gravity.CENTER);TextView s=new TextView(this);s.setText("Menu ativado por voz");s.setTextColor(0xFFB8B5C9);s.setGravity(Gravity.CENTER);b.addView(t,new LinearLayout.LayoutParams(-1,60));b.addView(s,new LinearLayout.LayoutParams(-1,45));LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER);Button m=new Button(this);m.setText("MINIMIZAR");m.setOnClickListener(v->min());Button x=new Button(this);x.setText("EXCLUIR");x.setOnClickListener(v->remove());row.addView(m);row.addView(x);b.addView(row,new LinearLayout.LayoutParams(-1,60));overlay=b;add(b,700,220);});}
 void min(){if(overlay==null)return;try{wm.removeView(overlay);}catch(Exception e){}ImageView b=new ImageView(this);b.setImageResource(com.korczak.morok.R.drawable.morok_logo);b.setPadding(18,18,18,18);b.setBackground(bg(0xEE0B0B16,0xAA9B6DFF,200));b.setOnClickListener(v->{try{wm.removeView(b);}catch(Exception e){}overlay=null;show();});b.setOnLongClickListener(v->{try{wm.removeView(b);}catch(Exception e){}overlay=null;return true;});overlay=b;add(b,150,150);}
 void add(View v,int w,int h){WindowManager.LayoutParams p=new WindowManager.LayoutParams(w,h,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);p.gravity=Gravity.CENTER;wm.addView(v,p);}
 void remove(){if(overlay!=null){try{wm.removeView(overlay);}catch(Exception e){}overlay=null;}}
 public int onStartCommand(Intent i,int f,int id){return START_STICKY;}public void onDestroy(){remove();if(r!=null)r.destroy();h.removeCallbacksAndMessages(null);super.onDestroy();}public IBinder onBind(Intent i){return null;}
}
EOF
cat > "$RES/xml/file_paths.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?><paths xmlns:android="http://schemas.android.com/apk/res/android"><external-files-path name="updates" path="Download/updates/" /></paths>
EOF
python3 - <<'PY'
from pathlib import Path
p=Path("apps/client/android/app/src/main/AndroidManifest.xml");s=p.read_text()
for x in ['<uses-permission android:name="android.permission.RECORD_AUDIO" />','<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />','<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />','<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />']:
 if x not in s:
  i=s.find('>', s.find('<manifest'))
  s=s[:i+1]+'\n    '+x+s[i+1:]
if "MorokWakeService" not in s:s=s.replace("</application>",'<service android:name="com.korczak.morok.MorokWakeService" android:exported="false" android:foregroundServiceType="microphone" />\n</application>')
if "FileProvider" not in s:s=s.replace("</application>",'<provider android:name="androidx.core.content.FileProvider" android:authorities="com.korczak.morok.fileprovider" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" /></provider>\n</application>')
p.write_text(s)
PY
