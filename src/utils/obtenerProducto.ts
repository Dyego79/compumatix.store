// src/utils/apiClient.js
import { obtenerToken } from "./apiclient";

//obtener token

export async function obtenerProductos() {
  const token = await obtenerToken();
  if (!token) {
    return [];
  }

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    redirect: "follow",
  };

  try {
    const response = await fetch("https://api.nb.com.ar/v1/", requestOptions);
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    return data; // Asegúrate de que esta es la estructura de la respuesta
  } catch (error) {
    console.error("Error al obtener los productos:", error);
    return [];
  }
}
