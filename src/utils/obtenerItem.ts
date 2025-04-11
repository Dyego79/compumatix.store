import { obtenerToken } from "./apiclient";

export const obtenerItem = async (id: string) => {
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
    const res = await fetch(`https://api.nb.com.ar/v1/item/${id}`);
    if (!res.ok) throw new Error("Error al obtener el producto");
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error al obtener el producto individual:", error);
    return null;
  }
};
