import React from "react";
import SelectDevice from "./SelectDevice";
import Device from "./Device";
import { Route, Routes, useLocation } from "react-router";
import { TopExtras } from "./TopExtras";
import { Box } from "@mui/material";

export default function Top() {
  const location = useLocation();
  console.log(location.pathname);

  return (
    <Box sx={{ height: "100%" }}>
      <Routes>
        <Route path="/device/*" element={<Device />} />
        <Route path="*" element={<SelectDevice />} />
      </Routes>
      <TopExtras />
    </Box>
  );
}
