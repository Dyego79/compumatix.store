// src/utils/apiClient.js
export async function obtenerToken() {
  const formdata = new FormData();
  formdata.append("user", "dyego79@gmail.com");
  formdata.append("password", "juli1416");
  formdata.append("mode", "api");

  const requestOptions: RequestInit = {
    method: "POST",
    body: formdata,
    redirect: "follow",
  };

  try {
    const response = await fetch(
      "https://api.nb.com.ar/v1/auth/login",
      requestOptions
    );
    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    return data.token; // Asegúrate de que esta es la estructura de la respuesta
  } catch (error) {
    console.error("Error al obtener el token:", error);
    return null;
  }
}
