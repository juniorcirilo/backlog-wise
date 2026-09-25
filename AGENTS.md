# AGENTS

- App runs 100% local: all data (usuários, sessão, solicitações, empresas, cadastros) lives in localStorage via src/services/mockStorage.ts and hooks/contexts — never add database or backend calls (user requirement).
- Auth is a mock user picker (AuthContext + usersRepo); no passwords — user chose to drop real login.
