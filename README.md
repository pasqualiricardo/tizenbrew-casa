# tizenbrew-casa

Módulo de [TizenBrew](https://github.com/reisxd/TizenBrew) para las teles Samsung de casa.

- **Casa**: abre la app de cámaras que sirve un puente en la red local. Este repo no tiene la app ni credenciales: el puente vive en la LAN y solo atiende a las teles de la casa.
- **Diagnóstico**: `service.js` corre dentro de la tele (Node.js de TizenBrew) y publica en `http://<tele>:8099/diag` la memoria, la carga, los discos y los procesos. Solo lectura.

Para agregarlo en TizenBrew: administrador de módulos → agregar módulo de GitHub → `pasqualiricardo/tizenbrew-casa@<versión>`. Usar siempre una versión fija.

Probado en una UN65MU6100 (Tizen 3.0).
