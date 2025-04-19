import { firebase } from "@/firebase/config";
import { z } from "astro/zod";
import { defineAction } from "astro:actions";
import {
  GoogleAuthProvider,
  signInWithCredential,
  type UserCredential,
} from "firebase/auth";

export const loginWithGoogle = defineAction({
  accept: "json",
  input: z.any(),
  handler: async (credentials: UserCredential) => {
    const credential = GoogleAuthProvider.credentialFromResult(credentials);

    if (!credential) {
      throw new Error("Google SignIn falló");
    }

    await signInWithCredential(firebase.auth, credential);

    return { ok: true };
  },
});
