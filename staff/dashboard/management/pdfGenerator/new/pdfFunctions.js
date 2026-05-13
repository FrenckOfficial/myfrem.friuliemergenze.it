const { jsPDF } = window.jspdf;

document.getElementById("logoutBtn").addEventListener("click", () => {
  await signOut(auth);
  window.location.href = "/login";
});

export function buildPDF(data) {

  const pdf = new jsPDF();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);

  pdf.text(
    data.title || "Documento",
    105,
    20,
    { align: "center" }
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  pdf.text(`Data: ${data.date || "-"}`, 14, 40);
  pdf.text(`Autore: ${data.author || "-"}`, 14, 48);
  pdf.text(`Tipo: ${data.type || "-"}`, 14, 56);

  pdf.line(14, 65, 195, 65);

  pdf.setFontSize(12);

  const splitContent = pdf.splitTextToSize(
    data.content || "",
    180
  );

  pdf.text(splitContent, 14, 80);

  pdf.setFontSize(10);
  pdf.setTextColor(120);

  pdf.text(
    data.footer || "MyFrEM PDF System",
    105,
    285,
    { align: "center" }
  );

  console.log("📄 PDF creato");

  return pdf;
}

export function exportPDFBlob(pdf) {
  return pdf.output("blob");
}

export function exportPDFBase64(pdf) {
  const blob = pdf.output("blob");

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);

  });
}

export function sanitizeFileName(str) {
  return (str || "")
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_-]/g, "");
}

export function downloadPDF(doc, data) {
  const fileName =
    `${sanitizeFileName(data.type)}_${sanitizeFileName(data.title)}_${Date.now()}.pdf`;

  doc.save(fileName);
}