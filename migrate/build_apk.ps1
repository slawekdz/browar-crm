# Build the signed release APK natively (ARM64 JDK 17 + Android SDK in C:\Users\slawe\android-tools).
# Usage: powershell -File migrate\build_apk.ps1   -> Downloads\browar-crm.apk
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$env:JAVA_HOME = "C:\Users\slawe\android-tools\jdk21\jdk-21.0.12.1+1"  # Capacitor's Android library targets Java 21
$env:ANDROID_HOME = "C:\Users\slawe\android-tools\sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

python migrate\build_app_web.py
npx cap sync android

$secrets = Get-Content migrate\.secrets.json -Raw | ConvertFrom-Json
$ksPassword = $secrets.keystore_password
if (-not $ksPassword) {
    $ksPassword = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    $secrets | Add-Member -NotePropertyName keystore_password -NotePropertyValue $ksPassword -Force
    $secrets | ConvertTo-Json | Set-Content migrate\.secrets.json -Encoding utf8
}
$keystore = "$root\migrate\release.keystore"
if (-not (Test-Path $keystore)) {
    # keytool logs to stderr; under ErrorActionPreference=Stop that would abort the script, so run it through cmd.
    cmd /c "`"$env:JAVA_HOME\bin\keytool.exe`" -genkeypair -keystore `"$keystore`" -alias browarcrm -keyalg RSA -keysize 2048 -validity 10000 -storepass $ksPassword -keypass $ksPassword -dname `"CN=Browar Pogorza CRM, O=Browar Pogorza, C=PL`" 2>nul"
    if (-not (Test-Path $keystore)) { throw "keystore not created" }
}

$env:KEYSTORE_FILE = $keystore
$env:KEYSTORE_PASSWORD = $ksPassword
$env:KEY_ALIAS = "browarcrm"
$env:KEY_PASSWORD = $ksPassword

"sdk.dir=" + ($env:ANDROID_HOME -replace "\\", "/") | Set-Content "$root\android\local.properties" -Encoding ascii
$gradle = Start-Process -FilePath "$root\android\gradlew.bat" -ArgumentList "--no-daemon", "assembleRelease" -WorkingDirectory "$root\android" `
    -RedirectStandardOutput "$root\android\build.log" -RedirectStandardError "$root\android\build.err.log" -NoNewWindow -Wait -PassThru
if ($gradle.ExitCode -ne 0) { Get-Content "$root\android\build.log" -Tail 30; Get-Content "$root\android\build.err.log" -Tail 30; throw "gradle failed" }

Copy-Item "$root\android\app\build\outputs\apk\release\app-release.apk" "$env:USERPROFILE\Downloads\browar-crm.apk" -Force
Write-Output "APK: $env:USERPROFILE\Downloads\browar-crm.apk"
