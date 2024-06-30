import { useEffect, useState } from "react";
import Nav from "../components/Nav";

const Companies = () => {
  const [companies, setCompanies] = useState([]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/companies`, {
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
        return;
      }

      const data = await res.json();
      setCompanies(data.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  return (
    <>
      <Nav />
      <div className="container my-4">
        <div className="row">
          <div className="col-md-1"></div>
          <div className="col-md-10">
            <div className="row align-items-center">
              <div className="col-md-6">
                <h1 className="mb-3">Companies</h1>
              </div>
              <div className="col-md-6 text-end">
                <a href="/companies/new" className="btn btn-primary mb-3">
                  New company
                </a>
              </div>
            </div>

            <table className="table table-bordered table-hover table-striped">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {companies.length > 0 ? (
                  companies.map((company) => {
                    return (
                      <tr key={company.id}>
                        <td>{company.id}</td>
                        <td>{company.name}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={2} className="text-center">
                      No companies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="col-md-1"></div>
        </div>
      </div>
    </>
  );
};

export default Companies;
