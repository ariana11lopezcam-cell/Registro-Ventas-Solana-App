# Entrega del proyecto

> **Fecha:** en las sesiones se indicó el **22 de noviembre** como límite. Confirma en Discord o en el GitBook si hay prórroga antes de enviar.

## Subir cambios

Con Source Control (agregar → commit → Sync) o en terminal:

```bash
git status
git add .
git commit -m "Proyecto final: registro de ventas con cajeros autorizados"
git push
```

## Revisión antes de enviar

- [ ] Repositorio público
- [ ] `README.md` con nombre, Program ID, URL y evidencias
- [ ] `programa/src/lib.rs` igual al desplegado (con tu `declare_id!`)
- [ ] `idl.json`, `src/config/programa.json` y `clients/js/` con tu despliegue
- [ ] Sin claves privadas, frases de recuperación ni archivos `*-keypair.json`
- [ ] Probado el recorrido de la guía

## Formulario

Se abre desde el GitBook: https://waylearn.gitbook.io/solana-engineering-track-advanced

| Campo | Qué poner |
| --- | --- |
| Nombre del proyecto | Registro de Ventas con Cajeros Autorizados |
| Categoría | La que corresponda (en las sesiones se mencionó *Blue Sky* para tema libre; confirma cuál aplica a un proyecto guiado ampliado) |
| Repositorio | URL de tu fork |
| Dirección en Devnet | Program ID |
| Datos personales | Los tuyos, como quieres que aparezcan en el certificado |
