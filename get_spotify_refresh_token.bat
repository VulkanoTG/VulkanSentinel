@echo off
setlocal

cd /d "%~dp0"

if exist ".env" (
  node --env-file=.env .\scripts\spotify-refresh-token.mjs
  goto :end
)

echo Arquivo .env nao encontrado na raiz do projeto.
echo Crie o .env com SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET e SPOTIFY_REDIRECT_URI.
exit /b 1

:end
endlocal
