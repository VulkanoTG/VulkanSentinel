# Migração de Express para Next

## Estado atual

O servidor web começou a ser desacoplado do Express.

- `src/server/server.ts` deve ficar responsável pelo adaptador HTTP.
- `src/web/session.ts` concentra cookies, sessão web e URL de OAuth.
- `src/web/profile.ts` concentra payload e leitura de dados do perfil.
- `src/web/pages.ts` será a casa temporária do HTML ainda não convertido para React.

## Próximo passo real

Depois desse desacoplamento, a troca para Next fica objetiva:

- `app/page.tsx` substitui `GET /`
- `app/privacidade/page.tsx` substitui `GET /privacidade`
- `app/perfil/page.tsx` substitui `GET /perfil`
- `app/api/profile/route.ts` substitui `GET /api/profile`
- `app/auth/twitch/login/route.ts` substitui `GET /auth/twitch/login`
- `app/auth/twitch/callback/route.ts` substitui `GET /auth/twitch/callback`
- `app/auth/logout/route.ts` substitui `GET /auth/logout`
- `app/webhook/twitch/eventsub/route.ts` substitui `POST /webhook/twitch/eventsub`

## Ordem recomendada

1. Instalar `next`, `react` e `react-dom`.
2. Criar o app Next da camada web.
3. Migrar primeiro `/` e `/privacidade`.
4. Depois migrar `/perfil` e `/api/profile`.
5. Por último migrar OAuth e EventSub.
