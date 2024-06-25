import Nav from "../components/Nav";

const Login = () => {
  return (
    <>
      <Nav />
      <div className="container my-4">
        <div className="row">
          <div className="col-md-4"></div>
          <div className="col-md-4">
            <h1 className="mb-3">Login</h1>

            <form action="" method="post">
              {/* Email. */}
              <div className="mb-3">
                <label htmlFor="email">Email</label>
                <input type="text" name="email" id="email" placeholder="kai@doe.com" className="form-control" />
              </div>

              {/* Password. */}
              <div className="mb-3">
                <label htmlFor="password">Password</label>
                <input type="password" name="password" id="password" placeholder="******" className="form-control" />
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
