import { useState } from "react";
import Nav from "../components/Nav";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }

      navigate("/companies");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <>
      <Nav />
      <div className="container my-4">
        <div className="row">
          <div className="col-md-4"></div>
          <div className="col-md-4">
            <h1 className="mb-3">Login</h1>

            <form onSubmit={handleSubmit} method="post">
              {/* Email. */}
              <div className="mb-3">
                <label htmlFor="email">Email</label>
                <input
                  type="text"
                  name="email"
                  id="email"
                  placeholder="kai@doe.com"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password. */}
              <div className="mb-3">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  placeholder="******"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Login button. */}
              <div className="mb-3">
                <button type="submit" className="btn btn-primary">
                  Login
                </button>
              </div>
            </form>
          </div>
          <div className="col-md-4"></div>
        </div>
      </div>
    </>
  );
};

export default Login;
