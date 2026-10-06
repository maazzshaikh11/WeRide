# WeRide R8/ProGuard rules for the release build (minifyEnabled + shrinkResources are ON for release).
#
# React Native (react-android) and Hermes ship their own consumer rules (keep @DoNotStrip, NativeModule implementers,
# @ReactProp setters, JNI natives, fbjni); we do not repeat them. Rules below are a CONSERVATIVE safety net for the native
# libraries used by this app, which are loaded through JNI, reflection or the React view-manager registry. They cost a
# little APK size and can be narrowed one library at a time AFTER a release build has been verified on a device
# (see docs/SECURITY.md, "Android release verification").

# Stack traces: keep line numbers (upload mapping.txt to Play Console), hide the source file name.
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# --- react-native-firebase (app, auth, firestore, messaging). Firebase SDKs ship their own consumer rules. ---
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**

# --- Mapbox (@rnmapbox/maps 10.x). The Mapbox Maps SDK AARs ship consumer rules; this covers the RN bridge/view managers. ---
-keep class com.rnmapbox.rnmbx.** { *; }
-keep class com.mapbox.** { *; }
-dontwarn com.mapbox.**

# --- react-native-webrtc (JNI into libjingle_peerconnection_so). org.webrtc is looked up by name from native code. ---
-keep class org.webrtc.** { *; }
-keep class com.oney.WebRTCModule.** { *; }
-dontwarn org.webrtc.**

# --- react-native-mmkv (JSI/JNI). ---
-keep class com.reactnativemmkv.** { *; }
-keep class com.tencent.mmkv.** { *; }

# --- react-native-keychain (Android Keystore + Facebook Conceal JNI). Holds the MMKV encryption key: must not break. ---
-keep class com.oblador.keychain.** { *; }
-keep class com.facebook.crypto.** { *; }
-keep class com.facebook.cipher.** { *; }
-dontwarn com.facebook.crypto.**

# --- react-native-background-geolocation (its own consumerProguardFiles also keep com.transistorsoft**). ---
-keep class com.transistorsoft.** { *; }
-dontwarn com.transistorsoft.**
-keep class ch.qos.logback.** { *; }
-keep class org.slf4j.** { *; }
-dontwarn ch.qos.logback.core.net.*

# --- react-native-svg (consumer rules also keep com.horcrux.svg). ---
-keep public class com.horcrux.svg.** { *; }

# --- Remaining native modules: small packages, resolved by the React package registry. ---
-keep class com.sensors.** { *; }
-keep class com.agontuk.RNFusedLocation.** { *; }
-keep class com.rnmlkit.textrecognition.** { *; }
-keep class com.reactnativecommunity.** { *; }
-keep class com.swmansion.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class org.reactnative.maskedview.** { *; }
-keep class org.linusu.** { *; }
-dontwarn com.google.mlkit.**

# --- Misc warnings from transitive networking libraries (OkHttp/Okio/Conscrypt are optional there). ---
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn javax.annotation.**
