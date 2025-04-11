/* import { loginUser, logout, registerUser } from './auth';
import { loadProductsFromCart } from './cart/load-products-from-cart.action'; */
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getProductsByPage } from "./products/get-products-by-page.action";
import { getFichaProducto } from "./products/get-ficha-producto.actions";

export const server = {
  // actions

  // Auth
  /*  loginUser,
  logout,
  registerUser, */

  // Products
  getProductsByPage,
  getProductBySlug,
  getFichaProducto,

  // Cart
  /* loadProductsFromCart, */
};
