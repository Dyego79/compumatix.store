import puppeteer from "puppeteer";
import fs from "fs";

// Configuración
const config = {
  url: "https://commerce.distecna.com/Pages/Products.aspx",
  loginUrl: "https://commerce.distecna.com/Pages/Public/Login.aspx",
  username: "compumatix.arg@gmail.com",
  password: "Pelusa141624?",
  outputFile: "productos_distecna.json",
};

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  try {
    await login(page);
    await page.goto(config.url, { waitUntil: "domcontentloaded" });

    const products = await scrapeProducts(page);

    fs.writeFileSync(config.outputFile, JSON.stringify(products, null, 2));
    console.log(
      `✅ Datos guardados en ${config.outputFile} (${products.length} productos)`
    );
  } catch (error) {
    console.error("❌ Error durante el scraping:", error);
  } finally {
    await browser.close();
  }
}

async function irAPagina(page: any, numeroPagina: number) {
  console.log(`⏭ Intentando ir a la página ${numeroPagina}...`);

  // Esperar a que el paginador esté cargado
  await page.waitForSelector("a", { timeout: 10000 });

  // Buscar el botón con el número de página como texto
  const links = await page.$$("a");
  let botonEncontrado = false;

  for (const link of links) {
    const text = await link.evaluate((el:any) => el.textContent?.trim());
    if (text === `${numeroPagina}`) {
      botonEncontrado = true;
      await Promise.all([
        link.click(),
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }),
      ]);
      console.log(`✅ Página ${numeroPagina} cargada correctamente.`);
      break;
    }
  }

  if (!botonEncontrado) {
    // Imprime el paginador para debug
    const paginationHtml = await page.evaluate(() => {
      const container = document.querySelector("#ctl00_ContentPlaceHolder1_rptPager");
      return container?.innerHTML || "No se encontró el paginador.";
    });
    console.error(`⚠️ HTML del paginador:\n${paginationHtml}`);
    throw new Error(`❌ No se encontró botón para ir a la página ${numeroPagina}`);
  }
}


async function login(page: any) {
  console.log("🔐 Iniciando sesión...");
  await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });
  await page.type("#UserName", config.username);
  await page.type("#Password", config.password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click("#Button1"),
  ]);
  console.log("✅ Sesión iniciada correctamente");
}

async function scrapeProducts(page: any) {
  console.log("📦 Comenzando extracción de productos...");
  const products: any[] = [];

  const totalPages = await page.evaluate(() => {
    const span = Array.from(
      document.querySelectorAll("span.rdpPagerLabel")
    ).find((el) => el.textContent?.includes("of"));
    if (!span) return 1;
    const match = span.textContent?.match(/of\s+(\d+)/);
    return match ? parseInt(match[1]) : 1;
  });

  console.log(`🔢 Total de páginas detectadas: ${totalPages}`);

  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    console.log(`📄 Extrayendo página ${currentPage} de ${totalPages}...`);

    await page.waitForFunction(
      () =>
        document.querySelectorAll(".contenedorProductos .NewitemProduct")
          .length > 0,
      { timeout: 15000 }
    );

    const pageProducts = await page.evaluate(() => {
      const cotizacionRaw =
        document
          .querySelector("#ctl00_ClientSelector_lbl_TipoCambio")
          ?.textContent?.trim() || "";
      const cotizacionParsed = parseFloat(
        cotizacionRaw.replace(/[^\d,]/g, "").replace(",", ".")
      );
      const cotizacion = isNaN(cotizacionParsed) ? 0 : cotizacionParsed;

      return Array.from(
        document.querySelectorAll(".contenedorProductos .NewitemProduct")
      ).map((el) => {
        const precioRaw =
          el
            .querySelector(".PriceWithoutDiscount_Panel2 span")
            ?.textContent?.trim() || "";
        const precioParsed = parseFloat(
          precioRaw.replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const precio = isNaN(precioParsed) ? 0 : precioParsed;

        const stockRaw =
          el.querySelector(".StockBox")?.textContent?.trim() || "";
        const stockParsed = parseInt(stockRaw.replace(/\D/g, ""));
        const stock = isNaN(stockParsed) ? 0 : stockParsed;

        const priceBox = el.querySelector(".NewtxtProductPrice");

        const ivaRaw =
          priceBox
            ?.querySelector("span[id*='PercentIva']")
            ?.textContent?.trim() || "";
        const ivaParsed = parseFloat(
          ivaRaw.replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const iva = isNaN(ivaParsed) ? 0 : ivaParsed;

        const impuestoRaw =
          priceBox
            ?.querySelector("span[id*='PercentImpInterno']")
            ?.textContent?.trim() || "";
        const impuestoParsed = parseFloat(
          impuestoRaw.replace(/[^0-9.,]/g, "").replace(",", ".")
        );
        const impuestoInterno = isNaN(impuestoParsed)
          ? 0
          : impuestoParsed;

        const precioFinal = parseFloat(
          (
            precio +
            (precio * iva) / 100 +
            (precio * impuestoInterno) / 100
          ).toFixed(2)
        );

        return {
          codigo:
            el.querySelector(".NewtxtProductRef")?.textContent?.trim() || "",
          nombre:
            el.querySelector(".NewtxtProductName")?.textContent?.trim() || "",
          precio,
          stock,
          iva,
          impuestoInterno,
          cotizacion,
          precioFinal,
          imagen: el.querySelector("img")?.getAttribute("src") || "",
          marca:
            el.querySelector(".Marca_Panel span")?.textContent?.trim() || "",
        };
      });
    });

    console.log(`✅ Página ${currentPage}: ${pageProducts.length} productos`);
    products.push(...pageProducts);

    if (currentPage < totalPages) {
      const nextPageNumber = currentPage + 1;
const previousHTML = await page.evaluate(() => {
  return document.querySelector(".contenedorProductos")?.innerHTML || "";
});

const pageChanged = await page.evaluate(() => {
  const nextBtn = document.querySelector("button.rdpPageNext") as HTMLElement;
  if (nextBtn) {
    nextBtn.click();
    return true;
  }
  return false;
});


if (!pageChanged) {
  throw new Error(`❌ No se encontró botón para ir a la página ${nextPageNumber}`);
}

try {
  await page.waitForFunction(
    (prevHTML:any) => {
      const currentHTML =
        document.querySelector(".contenedorProductos")?.innerHTML;
      return currentHTML && currentHTML !== prevHTML;
    },
    { timeout: 30000 },
    previousHTML
  );
  
} catch (err) {
  throw new Error(`❌ Timeout esperando a que se cargue la página ${nextPageNumber}`);
}

console.log("⏳ Esperando 10 segundos antes de continuar...");
await new Promise((res) => setTimeout(res, 10000));

    }
  }

  return products;
}

run();
