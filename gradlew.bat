@rem Gradle wrapper script for Ionic/Capacitor builds (Windows)
@rem This script forwards to the actual gradlew.bat in the android directory

@if "%DEBUG%" == "" @echo off
@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.

%DIRNAME%android\gradlew.bat %*
