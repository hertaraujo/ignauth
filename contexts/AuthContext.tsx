import Router from "next/router";
import { setCookie, parseCookies, destroyCookie } from "nookies";
import { createContext, useEffect, useState } from "react";
import { api } from "../services/apiClient";

type User = {
  email: string;
  permissions: string[];
  roles: string[];
};

type SignInCredentials = {
  email: string;
  password: string;
};

type AuthContexetData = {
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => void;
  user: User;
  isAuthenticated: boolean;
};

export const AuthContext = createContext({} as AuthContexetData);

let authChannel: BroadcastChannel;

export function signOut() {
  destroyCookie(undefined, "ignauth.token");
  destroyCookie(undefined, "ignauth.refreshToken");

  authChannel.postMessage("signOut");
  Router.push("/");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const isAuthenticated = !!user;

  useEffect(() => {
    authChannel = new BroadcastChannel("auth");

    authChannel.onmessage = (message) => {
      switch (message.data) {
        case "signOut":
          signOut();
          console.log(message)
          authChannel.close();
          break;

        /* case "signIn":
          Router.push("/dashboard");
          break; */
          
        default:
          break;
      }
    };
  }, []);

  useEffect(() => {
    const { "ignauth.token": token } = parseCookies();

    if (token) {
      api
        .get("/me")
        .then((res) => {
          const { email, permissions, roles } = res.data;

          setUser({ email, permissions, roles });
        })
        .catch(() => {
          signOut();
        });
    }
  }, []);

  async function signIn({ email, password }: SignInCredentials) {
    try {
      const res = await api.post("sessions", { email, password });
      const { token, refreshToken, permissions, roles } = res.data;

      setCookie(undefined, "ignauth.token", token, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
      setCookie(undefined, "ignauth.refreshToken", refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      setUser({ email, permissions, roles });

      // @ts-ignore: Unreachable code error
      api.defaults.headers["Authorization"] = `Bearer ${token}`;

      Router.push("/dashboard");

      // authChannel.postMessage("signIn");
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, signIn, user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
