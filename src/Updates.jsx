import React, { useEffect, useState } from "react";

export default function Updates() {
  const [show, setShow] = useState(false);
  const [popupContents, setPopupContents] = useState({
    contents: [],
  });

  useEffect(() => {
    // console.log("Top Of Updates");
    window.api.receive("checkingForUpdates", () => {
      console.log("Checking for updates");
    });

    window.api.receive("updateAvailable", () => {
      console.log("Downloading update");
      setPopupContents(prev => ({
        ...prev,
        contents: (
          <div>
            A new version is being downloaded
            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td>
                    <progress style={{ width: "100%" }} max={100} value="0" />
                  </td>
                </tr>
                <tr>
                  <td>
                    <button onClick={() => setShow(false)}>close</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      }));

      setShow(true);
    });

    window.api.receive("updateError", msg => {
      console.log("Update Error", msg);
    });

    window.api.receive("noUpdate", () => {
      console.log("Up to date");
    });

    window.api.receive("updateDownloaded", (e, releaseInfo) => {
      console.log("Update Downloaded");
      //console.log(releaseInfo)
      setPopupContents(prev => ({
        ...prev,
        contents: (
          <div>
            <p>New update {"v" + releaseInfo.version} downloaded</p>
            <table>
              <tbody>
                <tr>
                  <td>
                    <button onClick={() => setPopupContents({ contents: [] })}>
                      Update on exit
                    </button>
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        window.api.send("installUpdate");
                        setShow(false);
                      }}
                    >
                      Update and restart app now
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      }));

      setShow(true);
    });

    window.api.receive("updateError", error => {
      console.log("Update Error", error);
    });

    window.api.receive("updateDownloadProgress", (e, progressPercent) => {
      setPopupContents(prev => ({
        ...prev,
        contents: (
          <div>
            A new version is being downloaded
            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td>
                    <progress
                      style={{ width: "100%" }}
                      max="100"
                      value={Math.round(progressPercent).toString()}
                    />
                  </td>
                </tr>
                <tr>
                  <td>
                    <button onClick={() => setShow(false)}>hide</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      }));
    });

    return () => {
      window.api.removeAllListeners("checkingForUpdates");
      window.api.removeAllListeners("updateAvailable");
      window.api.removeAllListeners("noUpdate");
      window.api.removeAllListeners("updateError");
      window.api.removeAllListeners("updateDownloaded");
      window.api.removeAllListeners("updateDownloadProgress");
    };
  }, []);

  const makePopup = () => {
    if (show === true) {
      return (
        <div
          style={{
            position: "fixed",
            bottom: "10px",
            right: "10px",
            backgroundColor: "white",
            padding: "10px",
            boxShadow: "0px 0px 6px 2px",
            fontSize: "12px",
          }}
        >
          {popupContents.contents}
        </div>
      );
    } else {
      return <div></div>;
    }
  };

  return makePopup();
}
