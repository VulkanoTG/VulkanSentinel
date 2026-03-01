@echo off
REM show_twitch_user_id.bat
REM Loads .env in the current folder and calls Twitch Helix to get the numeric user id

if not exist .env (
  echo .env not found in current directory.
  pause
  exit /b 1
)

for /f "usebackq tokens=1* delims==" %%A in (".env") do (
  if not "%%A"=="" (
    set "%%A=%%B"
  )
)

REM Strip possible surrounding quotes from variables
set TWITCH_CLIENT_ID=%TWITCH_CLIENT_ID:"=%
set TWITCH_USER_TOKEN=%TWITCH_USER_TOKEN:"=%
set TWITCH_USERNAME=%TWITCH_USERNAME:"=%

echo Using Client ID: %TWITCH_CLIENT_ID%
echo Using Username: %TWITCH_USERNAME%
echo.

curl -s -H "Client-ID: %TWITCH_CLIENT_ID%" -H "Authorization: Bearer %TWITCH_USER_TOKEN%" "https://api.twitch.tv/helix/users?login=%TWITCH_USERNAME%"

echo.
pause
