import { Box } from "@mui/material";
import { Route, Routes } from "react-router";
import Device from "./Device";
import SelectDevice from "./SelectDevice";
import { TopExtras } from "./TopExtras";

export default function Top() {
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
