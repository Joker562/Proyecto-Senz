@echo off
:: Este script debe ejecutarse como Administrador
echo Abriendo puertos en el Firewall de Windows...
netsh advfirewall firewall add rule name="Planta MTTO Frontend (5173)" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Planta MTTO Backend (4000)" dir=in action=allow protocol=TCP localport=4000
echo.
echo Listo. Los puertos 5173 y 4000 estan abiertos en la red local.
echo.
echo Otros equipos pueden acceder en: http://192.168.254.28:5173
pause
