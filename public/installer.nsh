!define MUI_BGCOLOR "17131F"
!define MUI_TEXTCOLOR "FFFFFF"

!macro customInit
  ${ifNot} ${isUpdated}
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $0 == ""
      ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${endIf}
    ${if} $0 != ""
      MessageBox MB_YESNO|MB_ICONQUESTION "An existing Luna installation was found at:$\r$\n$0$\r$\n$\r$\nReplace it with this version? Your settings and music library will be kept." IDYES +2
      Abort
    ${endIf}
  ${endIf}
!macroend

!macro registerLunaAudioType extension description
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".${extension}" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\.${extension}\OpenWithProgids" "Luna.Audio.${extension}" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\Luna.Audio.${extension}" "" "${description}"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Luna.Audio.${extension}\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Luna.Audio.${extension}\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  WriteRegStr SHELL_CONTEXT "Software\Luna\Capabilities\FileAssociations" ".${extension}" "Luna.Audio.${extension}"
!macroend

!macro unregisterLunaAudioType extension
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.${extension}\OpenWithProgids" "Luna.Audio.${extension}"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Luna.Audio.${extension}"
!macroend

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  !insertmacro registerLunaAudioType "mp3" "MP3 Audio"
  !insertmacro registerLunaAudioType "m4a" "M4A Audio"
  !insertmacro registerLunaAudioType "wav" "WAV Audio"
  !insertmacro registerLunaAudioType "flac" "FLAC Audio"
  !insertmacro registerLunaAudioType "ogg" "OGG Audio"
  !insertmacro registerLunaAudioType "oga" "OGA Audio"
  !insertmacro registerLunaAudioType "aac" "AAC Audio"
  !insertmacro registerLunaAudioType "mp4" "MP4 Audio"
  !insertmacro registerLunaAudioType "m4b" "M4B Audio"
  !insertmacro registerLunaAudioType "m4p" "M4P Audio"
  !insertmacro registerLunaAudioType "mpg" "MPEG Audio"
  !insertmacro registerLunaAudioType "mp2" "MP2 Audio"
  !insertmacro registerLunaAudioType "mpe" "MPEG Audio"
  !insertmacro registerLunaAudioType "mpeg" "MPEG Audio"
  !insertmacro registerLunaAudioType "wma" "WMA Audio"
  !insertmacro registerLunaAudioType "wmv" "WMV Audio"
  !insertmacro registerLunaAudioType "asf" "ASF Audio"
  !insertmacro registerLunaAudioType "aif" "AIFF Audio"
  !insertmacro registerLunaAudioType "aiff" "AIFF Audio"
  !insertmacro registerLunaAudioType "aifc" "AIFC Audio"
  WriteRegStr SHELL_CONTEXT "Software\Luna\Capabilities" "ApplicationName" "Luna Music"
  WriteRegStr SHELL_CONTEXT "Software\Luna\Capabilities" "ApplicationDescription" "Play audio files with Luna Music"
  WriteRegStr SHELL_CONTEXT "Software\Luna\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "Luna Music" "Software\Luna\Capabilities"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "Luna Music"
  DeleteRegKey SHELL_CONTEXT "Software\Luna\Capabilities"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  !insertmacro unregisterLunaAudioType "mp3"
  !insertmacro unregisterLunaAudioType "m4a"
  !insertmacro unregisterLunaAudioType "wav"
  !insertmacro unregisterLunaAudioType "flac"
  !insertmacro unregisterLunaAudioType "ogg"
  !insertmacro unregisterLunaAudioType "oga"
  !insertmacro unregisterLunaAudioType "aac"
  !insertmacro unregisterLunaAudioType "mp4"
  !insertmacro unregisterLunaAudioType "m4b"
  !insertmacro unregisterLunaAudioType "m4p"
  !insertmacro unregisterLunaAudioType "mpg"
  !insertmacro unregisterLunaAudioType "mp2"
  !insertmacro unregisterLunaAudioType "mpe"
  !insertmacro unregisterLunaAudioType "mpeg"
  !insertmacro unregisterLunaAudioType "wma"
  !insertmacro unregisterLunaAudioType "wmv"
  !insertmacro unregisterLunaAudioType "asf"
  !insertmacro unregisterLunaAudioType "aif"
  !insertmacro unregisterLunaAudioType "aiff"
  !insertmacro unregisterLunaAudioType "aifc"
  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
