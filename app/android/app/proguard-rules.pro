# The Flutter ML Kit OCR bridge references optional language recognizers.
# This build ships the Chinese recognizer only. These other languages are not
# invoked from HAIZ Inbox. Suppress only R8 missing-class warnings for them.
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**
