@echo off
for /d /r %%d in (*) do (
  if not exist "%%d\.gitignore" (
    echo node_modules > "%%d\.gitignore"
  )
)
echo Done.
