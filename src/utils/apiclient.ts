export async function obtenerToken(): Promise<string> {
  const formdata = new FormData();
  formdata.append("user", process.env.API_USER || "");
  formdata.append("password", process.env.API_PASSWORD || "");
  formdata.append("mode", "api");

  const headers = new Headers();
  headers.append("Authorization", "Basic ZHllZ283OUBnbWFpbC5jb206anVsaTE0MTY=");

  const response = await fetch("https://api.nb.com.ar/v1/auth/login", {
    method: "POST",
    headers,
    body: formdata,
    redirect: "follow" as RequestRedirect,
  });

  const text = await response.text();

  // 🧼 Limpiar todo lo que venga antes del JSON válido
  const jsonStart = text.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("❌ No se encontró JSON en la respuesta: " + text);
  }

  const cleanJson = text.slice(jsonStart);

  try {
    const data = JSON.parse(cleanJson);
    if (!data.token)
      throw new Error("❌ No se encontró el token en el JSON: " + cleanJson);
    return data.token;
  } catch (err) {
    console.error("❌ Error al parsear JSON del token:", cleanJson);
    throw err;
  }
}

/* export async function obtenerToken() {
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
 */
