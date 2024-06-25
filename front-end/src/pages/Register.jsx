import Nav from "../components/Nav";

const Register = () => {
  return (
    <>
      <Nav />
      <div className="container my-4">
        <div className="row">
          <div className="col-md-4"></div>
          <div className="col-md-4">
            <h1 className="mb-3">Register</h1>

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

              {/* Confirm password. */}
              <div className="mb-3">
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  placeholder="******"
                  className="form-control"
                />
              </div>

              {/* Register button. */}
              <div className="mb-3">
                <button type="submit" className="btn btn-primary">
                  Register
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

export default Register;
