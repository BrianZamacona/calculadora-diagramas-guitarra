import { mountApp } from "./ui";

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("No se encontró el punto de montaje de la aplicación.");
mountApp(appRoot);
