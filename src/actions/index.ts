/* import { loginUser, logout, registerUser } from './auth';
import { loadProductsFromCart } from './cart/load-products-from-cart.action'; */
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getProductsByPage } from "./products/get-products-by-page.action";
import { getFichaProducto } from "./products/get-ficha-producto.actions";
import { loginUser } from "./auth/login.action";
import { loginWithGoogle } from "./auth/login-google.action";
import { registerUser } from "./auth/register.action";
import { addToCart } from "./cart/addToCart.actions";
import { getCart } from "./cart/getCart.actions";

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
  loginUser,
  loginWithGoogle,
  registerUser,
  addToCart,
  getCart,
  // Cart
  /* loadProductsFromCart, */
};
