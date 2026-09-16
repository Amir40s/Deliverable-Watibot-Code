import { Document, Page, Text, View, StyleSheet, Font } from'@react-pdf/renderer';
import { format } from'date-fns';

// Register a nice font if possible, or use standard sans-serif
// Font.register({ family:'Nunito', src:'https://fonts.gstatic.com/s/nunito/v16/XRXV3I6Li01BKofINeaB.ttf' });

const styles = StyleSheet.create({
 page: {
 padding: 40,
 backgroundColor:'#FFFFFF',
 fontFamily:'Helvetica',
 },
 header: {
 marginBottom: 30,
 borderBottom: 2,
 borderBottomColor:'#10b981',
 paddingBottom: 15,
 flexDirection:'row',
 justifyContent:'space-between',
 alignItems:'center',
 },
 orgName: {
 fontSize: 24,
 fontWeight:'bold',
 color:'#0f172a',
 textTransform:'uppercase',
 },
 reportTitle: {
 fontSize: 10,
 color:'#10b981',
 fontWeight:'bold',
 letterSpacing: 2,
 },
 metaSection: {
 marginBottom: 20,
 flexDirection:'row',
 justifyContent:'space-between',
 },
 metaItem: {
 fontSize: 9,
 color:'#64748b',
 },
 metaValue: {
 fontSize: 10,
 fontWeight:'bold',
 color:'#0f172a',
 },
 sectionTitle: {
 fontSize: 14,
 fontWeight:'bold',
 color:'#0f172a',
 marginBottom: 15,
 marginTop: 20,
 borderLeft: 4,
 borderLeftColor:'#10b981',
 paddingLeft: 10,
 },
 kpiGrid: {
 flexDirection:'row',
 flexWrap:'wrap',
 gap: 15,
 marginBottom: 30,
 },
 kpiCard: {
 width:'48%',
 padding: 15,
 backgroundColor:'#F8F9FB',
 borderRadius: 8,
 borderWidth: 1,
 borderColor:'#e2e8f0',
 },
 kpiLabel: {
 fontSize: 8,
 color:'#64748b',
 textTransform:'uppercase',
 letterSpacing: 1,
 marginBottom: 5,
 },
 kpiValue: {
 fontSize: 18,
 fontWeight:'bold',
 color:'#0f172a',
 },
 table: {
 display:'flex',
 width:'auto',
 marginTop: 10,
 borderStyle:'solid',
 borderWidth: 1,
 borderColor:'#e2e8f0',
 borderRadius: 8,
 overflow:'hidden',
 },
 tableRow: {
 flexDirection:'row',
 borderBottomColor:'#e2e8f0',
 borderBottomWidth: 1,
 minHeight: 30,
 alignItems:'center',
 },
 tableHeader: {
 backgroundColor:'#F8F9FB',
 borderBottomWidth: 2,
 borderBottomColor:'#10b981',
 },
 tableCellHeader: {
 fontSize: 8,
 fontWeight:'bold',
 color:'#64748b',
 paddingHorizontal: 10,
 textTransform:'uppercase',
 },
 tableCell: {
 fontSize: 9,
 color:'#0f172a',
 paddingHorizontal: 10,
 },
 footer: {
 position:'absolute',
 bottom: 30,
 left: 40,
 right: 40,
 textAlign:'center',
 fontSize: 8,
 color:'#94a3b8',
 borderTop: 1,
 borderTopColor:'#e2e8f0',
 paddingTop: 10,
 }
});

interface ReportPDFProps {
 data: any;
 dateRange: { start: Date; end: Date };
 orgName: string;
}

const ReportPDF = ({ data, dateRange, orgName }: ReportPDFProps) => {
  const kpis = [
    { label: 'Total Conversations', value: data?.kpis?.totalConversations?.value || '0' },
    { label: 'AI Messages Sent', value: data?.kpis?.aiMessages?.value || '0' },
    { label: 'Human Messages Sent', value: data?.kpis?.humanMessages?.value || '0' },
    { label: 'AI Automation Rate', value: data?.kpis?.automationRate?.value || '0%' },
    { label: 'Avg. Human Response', value: data?.kpis?.avgResponseTime?.value || '0s' },
    { label: 'Delivery Rate', value: data?.messageHealth ? `${data.messageHealth.deliveryRate}%` : 'N/A' },
  ];

 return (
 <Document>
 <Page size="A4" style={styles.page}>
 {/* Header */}
 <View style={styles.header}>
 <View>
 <Text style={styles.orgName}>{orgName ||'WatiBot AI'}</Text>
 <Text style={styles.reportTitle}>BUSINESS PERFORMANCE REPORT</Text>
 </View>
 </View>

 {/* Meta Info */}
 <View style={styles.metaSection}>
 <View>
 <Text style={styles.metaItem}>Report Period</Text>
 <Text style={styles.metaValue}>
 {format(dateRange.start,'MMM dd, yyyy')} - {format(dateRange.end,'MMM dd, yyyy')}
 </Text>
 </View>
 <View style={{ textAlign:'right' }}>
 <Text style={styles.metaItem}>Generated On</Text>
 <Text style={styles.metaValue}>{format(new Date(),'PPpp')}</Text>
 </View>
 </View>

 {/* Executive Summary Titles */}
 <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
 
 {/* KPI Grid */}
 <View style={styles.kpiGrid}>
 {kpis.map((kpi, index) => (
 <View key={index} style={styles.kpiCard}>
 <Text style={styles.kpiLabel}>{kpi.label}</Text>
 <Text style={styles.kpiValue}>{kpi.value}</Text>
 </View>
 ))}
 </View>

 {/* Agent Performance Section */}
 <Text style={styles.sectionTitle}>Agent Performance Analytics</Text>
 
 <View style={styles.table}>
 {/* Table Header */}
 <View style={[styles.tableRow, styles.tableHeader]}>
 <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Agent Name</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Messages</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Chats</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Avg. Resp</Text></View>
 </View>

 {/* Table Rows */}
 {(data?.agents || []).map((agent: any, index: number) => (
 <View key={index} style={styles.tableRow}>
 <View style={{ width:'40%' }}><Text style={styles.tableCell}>{agent?.name || agent?.email ||'Unknown Agent'}</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCell}>{agent?.messagesSent || 0}</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCell}>{agent?.chatsAssigned || 0}</Text></View>
 <View style={{ width:'20%' }}><Text style={styles.tableCell}>{agent?.avgResponseTime ||'0s'}</Text></View>
 </View>
 ))}
 </View>

 {/* Segments Analytics Section */}
 <Text style={styles.sectionTitle}>Segments Analytics</Text>
 <View style={styles.table}>
   <View style={[styles.tableRow, styles.tableHeader]}>
     <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Segment Name</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Total Contacts</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Active Contacts</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Growth</Text></View>
   </View>
   {(data?.segments || []).map((item: any, index: number) => (
     <View key={index} style={styles.tableRow}>
       <View style={{ width:'40%' }}><Text style={styles.tableCell}>{item?.name || 'Unknown'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.total || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.active || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.growth || '0%'}</Text></View>
     </View>
   ))}
 </View>

 {/* Campaigns Performance Section */}
 <Text style={styles.sectionTitle}>Campaigns Performance</Text>
 <View style={styles.table}>
   <View style={[styles.tableRow, styles.tableHeader]}>
     <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Campaign Name</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Status</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Sent</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Delivered</Text></View>
   </View>
   {(data?.campaigns || []).map((item: any, index: number) => (
     <View key={index} style={styles.tableRow}>
       <View style={{ width:'40%' }}><Text style={styles.tableCell}>{item?.name || 'Unknown'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.status || 'Pending'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.sent || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.delivered || 0}</Text></View>
     </View>
   ))}
 </View>

 {/* Automations Overview Section */}
 <Text style={styles.sectionTitle}>Automations Overview</Text>
 <View style={styles.table}>
   <View style={[styles.tableRow, styles.tableHeader]}>
     <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Automation Name</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Status</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Triggers</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Actions</Text></View>
   </View>
   {(data?.automations || []).map((item: any, index: number) => (
     <View key={index} style={styles.tableRow}>
       <View style={{ width:'40%' }}><Text style={styles.tableCell}>{item?.name || 'Unknown'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.status || 'Inactive'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.triggers || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.actions || 0}</Text></View>
     </View>
   ))}
 </View>

 {/* Flows Performance Section */}
 <Text style={styles.sectionTitle}>Flows Performance</Text>
 <View style={styles.table}>
   <View style={[styles.tableRow, styles.tableHeader]}>
     <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Flow Name</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Status</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Executions</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Failed</Text></View>
   </View>
   {(data?.flows || []).map((item: any, index: number) => (
     <View key={index} style={styles.tableRow}>
       <View style={{ width:'40%' }}><Text style={styles.tableCell}>{item?.name || 'Unknown'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.isActive ? 'Active' : 'Inactive'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.totalExecutions || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.failedExecutions || 0}</Text></View>
     </View>
   ))}
 </View>

 {/* Templates Performance Section */}
 <Text style={styles.sectionTitle}>Templates Performance</Text>
 <View style={styles.table}>
   <View style={[styles.tableRow, styles.tableHeader]}>
     <View style={{ width:'40%' }}><Text style={styles.tableCellHeader}>Template Name</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Status</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Sent</Text></View>
     <View style={{ width:'20%' }}><Text style={styles.tableCellHeader}>Delivered</Text></View>
   </View>
   {(data?.templates || []).map((item: any, index: number) => (
     <View key={index} style={styles.tableRow}>
       <View style={{ width:'40%' }}><Text style={styles.tableCell}>{item?.name || 'Unknown'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.status || 'Pending'}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.sent || 0}</Text></View>
       <View style={{ width:'20%' }}><Text style={styles.tableCell}>{item?.delivered || 0}</Text></View>
     </View>
   ))}
 </View>

 {/* Footer */}
 <View style={styles.footer}>
 <Text>This report was automatically generated by WatiBot AI Analytics Engine.</Text>
 <Text render={({ pageNumber, totalPages }) =>`Page ${pageNumber} of ${totalPages}`} />
 </View>
 </Page>
 </Document>
 );
};

export default ReportPDF;
