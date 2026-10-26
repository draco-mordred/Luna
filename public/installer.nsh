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
